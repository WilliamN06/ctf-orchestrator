import { Agent } from "agents";

/**
 * CompetitionAgent — single Durable Object for the whole competition.
 *
 * Responsibilities:
 *  - Team registration and auth token issuance
 *  - Scoreboard: receives solve events from Workers, persists in SQL
 *  - Real-time: broadcasts score updates to all connected WebSocket clients
 *  - Cron: alarm() fires at competition end to close and publish final results
 *
 * State schema (DO SQL):
 *   teams(id TEXT PK, name TEXT, country TEXT, token TEXT, created_at INTEGER)
 *   scores(team_id TEXT PK, score INTEGER, last_solve INTEGER)
 *   solves(team_id TEXT, challenge_id TEXT, points INTEGER, solved_at INTEGER)
 *   competition(key TEXT PK, value TEXT)
 */
export class CompetitionAgent extends Agent {
  // Active WebSocket connections — keyed by team_id
  #connections = new Map();

  async onStart() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS teams (
        id         TEXT    PRIMARY KEY,
        name       TEXT    NOT NULL UNIQUE,
        country    TEXT    NOT NULL DEFAULT '🏳',
        token      TEXT    NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS scores (
        team_id    TEXT    PRIMARY KEY,
        score      INTEGER NOT NULL DEFAULT 0,
        last_solve INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS solves (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id      TEXT    NOT NULL,
        challenge_id TEXT    NOT NULL,
        points       INTEGER NOT NULL,
        solved_at    INTEGER NOT NULL,
        UNIQUE(team_id, challenge_id)
      );

      CREATE TABLE IF NOT EXISTS competition (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Default competition state
      INSERT OR IGNORE INTO competition (key, value) VALUES
        ('status',    'active'),
        ('end_time',  '${Date.now() + 12 * 60 * 60 * 1000}'),
        ('name',      'Hack South West 2026');
    `);

    // Schedule alarm for competition end
    const endTime = this.#getCompetitionValue("end_time");
    if (endTime) {
      const t = parseInt(endTime);
      if (t > Date.now()) {
        await this.ctx.storage.setAlarm(t);
      }
    }
  }

  // ── WebSocket handling ──────────────────────────────────────────────────────

  /**
   * Called by Cloudflare when a WebSocket connection is established.
   * The Worker upgrades the HTTP request and forwards it here.
   */
  async onConnect(connection, ctx) {
    const teamId = ctx.url.searchParams.get("team_id");
    if (teamId) {
      this.#connections.set(teamId, connection);
    }

    // Send current scoreboard immediately on connect
    connection.send(JSON.stringify({
      type: "SCOREBOARD_INIT",
      scoreboard: this.#buildScoreboard(),
    }));

    connection.addEventListener("close", () => {
      if (teamId) this.#connections.delete(teamId);
    });
  }

  // ── RPC methods (called by Workers) ────────────────────────────────────────

  /**
   * Register a new team. Returns { teamId, token } or error.
   */
  async registerTeam(name, country = "🏳") {
    const existing = this.ctx.storage.sql
      .exec(`SELECT id FROM teams WHERE name = ?`, name)
      .toArray();
    if (existing.length > 0) {
      return { error: "Team name already taken" };
    }

    const teamId = crypto.randomUUID();
    const token  = crypto.randomUUID();
    const now    = Date.now();

    this.ctx.storage.sql.exec(
      `INSERT INTO teams (id, name, country, token, created_at) VALUES (?, ?, ?, ?, ?)`,
      teamId, name, country, token, now
    );
    this.ctx.storage.sql.exec(
      `INSERT INTO scores (team_id, score, last_solve) VALUES (?, 0, 0)`,
      teamId
    );

    this.#broadcast({ type: "TEAM_JOINED", teamName: name, country });
    return { teamId, token };
  }

  /**
   * Validate a team token. Returns { teamId, name } or null.
   */
  async validateToken(token) {
    const rows = this.ctx.storage.sql
      .exec(`SELECT id, name FROM teams WHERE token = ?`, token)
      .toArray();
    return rows.length > 0 ? { teamId: rows[0].id, name: rows[0].name } : null;
  }

  /**
   * Record a solve and update the scoreboard.
   * Called by the flag submission Worker after ChallengeAgent confirms correctness.
   */
  async recordSolve(teamId, challengeId, points) {
    try {
      this.ctx.storage.sql.exec(
        `INSERT INTO solves (team_id, challenge_id, points, solved_at) VALUES (?, ?, ?, ?)`,
        teamId, challengeId, points, Date.now()
      );
    } catch {
      // UNIQUE constraint — already solved, ignore
      return { duplicate: true };
    }

    // Update score
    this.ctx.storage.sql.exec(
      `UPDATE scores SET score = score + ?, last_solve = ? WHERE team_id = ?`,
      points, Date.now(), teamId
    );

    const team = this.ctx.storage.sql
      .exec(`SELECT name, country FROM teams WHERE id = ?`, teamId)
      .toArray()[0];

    const newScore = this.ctx.storage.sql
      .exec(`SELECT score FROM scores WHERE team_id = ?`, teamId)
      .toArray()[0]?.score;

    // Broadcast to all connected clients
    this.#broadcast({
      type: "SOLVE",
      teamId,
      teamName: team?.name,
      country:  team?.country,
      challengeId,
      points,
      newScore,
      scoreboard: this.#buildScoreboard(),
    });

    return { success: true, newScore };
  }

  /**
   * Return the current scoreboard as a sorted array.
   */
  async getScoreboard() {
    return this.#buildScoreboard();
  }

  /**
   * Return all teams (for admin).
   */
  async getTeams() {
    return this.ctx.storage.sql
      .exec(`SELECT id, name, country, created_at FROM teams ORDER BY created_at ASC`)
      .toArray();
  }

  /**
   * Update competition metadata (admin only).
   */
  async setCompetitionValue(key, value) {
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO competition (key, value) VALUES (?, ?)`,
      key, String(value)
    );
    if (key === "end_time") {
      const t = parseInt(value);
      if (t > Date.now()) await this.ctx.storage.setAlarm(t);
    }
    return { ok: true };
  }

  // ── Cron alarm ──────────────────────────────────────────────────────────────

  /**
   * Fires at competition end time.
   * Sets status to "ended" and broadcasts final results.
   */
  async alarm() {
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO competition (key, value) VALUES ('status', 'ended')`
    );
    this.#broadcast({
      type: "COMPETITION_ENDED",
      finalScoreboard: this.#buildScoreboard(),
    });
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  #buildScoreboard() {
    return this.ctx.storage.sql.exec(`
      SELECT
        t.id, t.name, t.country,
        s.score, s.last_solve,
        COUNT(sv.id) AS solve_count
      FROM teams t
      JOIN scores s ON s.team_id = t.id
      LEFT JOIN solves sv ON sv.team_id = t.id
      GROUP BY t.id
      ORDER BY s.score DESC, s.last_solve ASC
    `).toArray();
  }

  #getCompetitionValue(key) {
    const rows = this.ctx.storage.sql
      .exec(`SELECT value FROM competition WHERE key = ?`, key)
      .toArray();
    return rows[0]?.value ?? null;
  }

  #broadcast(msg) {
    const payload = JSON.stringify(msg);
    for (const conn of this.#connections.values()) {
      try { conn.send(payload); } catch { /* client disconnected */ }
    }
  }
}
