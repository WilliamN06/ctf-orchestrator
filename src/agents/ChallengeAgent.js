import { Agent } from "agents";

/**
 * ChallengeAgent — one Durable Object instance per challenge.
 *
 * Responsibilities:
 *  - Store all attempt history per team in built-in SQLite
 *  - Track which teams have solved the challenge + timestamps
 *  - Track hint usage per team
 *  - Expose RPC methods callable by the Worker via @callable
 *
 * State schema (DO SQL):
 *   attempts(team_id TEXT, submitted_at INTEGER, flag TEXT, correct INTEGER)
 *   solves(team_id TEXT, solved_at INTEGER, PRIMARY KEY team_id)
 *   hints(team_id TEXT, hint_index INTEGER)
 */
export class ChallengeAgent extends Agent {
  /**
   * Called once when the DO is first created.
   * Creates the SQLite tables if they don't exist.
   */
  async onStart() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS attempts (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id    TEXT    NOT NULL,
        flag       TEXT    NOT NULL,
        correct    INTEGER NOT NULL DEFAULT 0,
        submitted_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS solves (
        team_id   TEXT    PRIMARY KEY,
        solved_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS hints (
        team_id    TEXT    NOT NULL,
        hint_index INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (team_id)
      );
    `);
  }

  /**
   * Submit a flag attempt for a team.
   * Returns { correct, firstBlood, attempts }
   */
  async submitFlag(teamId, submittedFlag, correctFlag) {
    const now = Date.now();

    // Record the attempt
    this.ctx.storage.sql.exec(
      `INSERT INTO attempts (team_id, flag, correct, submitted_at) VALUES (?, ?, ?, ?)`,
      teamId, submittedFlag, submittedFlag === correctFlag ? 1 : 0, now
    );

    if (submittedFlag !== correctFlag) {
      const [{ count }] = this.ctx.storage.sql
        .exec(`SELECT COUNT(*) as count FROM attempts WHERE team_id = ?`, teamId)
        .toArray();
      return { correct: false, attempts: count };
    }

    // Check if already solved
    const existing = this.ctx.storage.sql
      .exec(`SELECT team_id FROM solves WHERE team_id = ?`, teamId)
      .toArray();
    if (existing.length > 0) {
      return { correct: true, alreadySolved: true };
    }

    // Record solve
    this.ctx.storage.sql.exec(
      `INSERT INTO solves (team_id, solved_at) VALUES (?, ?)`,
      teamId, now
    );

    // Is this first blood?
    const [{ count: solveCount }] = this.ctx.storage.sql
      .exec(`SELECT COUNT(*) as count FROM solves`)
      .toArray();

    return { correct: true, firstBlood: solveCount === 1, solvedAt: now };
  }

  /**
   * Get the next hint index for a team and increment it.
   * Returns the index to serve (0-based), or -1 if all hints exhausted.
   */
  async requestHint(teamId, totalHints) {
    const rows = this.ctx.storage.sql
      .exec(`SELECT hint_index FROM hints WHERE team_id = ?`, teamId)
      .toArray();

    const currentIndex = rows.length > 0 ? rows[0].hint_index : 0;

    if (currentIndex >= totalHints) {
      return { index: -1, exhausted: true };
    }

    if (rows.length === 0) {
      this.ctx.storage.sql.exec(
        `INSERT INTO hints (team_id, hint_index) VALUES (?, ?)`,
        teamId, currentIndex + 1
      );
    } else {
      this.ctx.storage.sql.exec(
        `UPDATE hints SET hint_index = ? WHERE team_id = ?`,
        currentIndex + 1, teamId
      );
    }

    return { index: currentIndex, exhausted: false };
  }

  /**
   * Get full stats for this challenge (for admin panel).
   */
  async getStats() {
    const solves = this.ctx.storage.sql
      .exec(`SELECT team_id, solved_at FROM solves ORDER BY solved_at ASC`)
      .toArray();

    const [{ total }] = this.ctx.storage.sql
      .exec(`SELECT COUNT(*) as total FROM attempts`)
      .toArray();

    const [{ incorrect }] = this.ctx.storage.sql
      .exec(`SELECT COUNT(*) as incorrect FROM attempts WHERE correct = 0`)
      .toArray();

    return {
      totalSolves: solves.length,
      solveOrder: solves,
      totalAttempts: total,
      incorrectAttempts: incorrect,
    };
  }

  /**
   * Reset this challenge (admin only) — clears all solves and attempts.
   */
  async reset() {
    this.ctx.storage.sql.exec(`DELETE FROM solves; DELETE FROM attempts; DELETE FROM hints;`);
    return { reset: true };
  }
}
