import { routeAgentRequest } from "agents";
import { ChallengeAgent } from "./agents/ChallengeAgent.js";
import { CompetitionAgent } from "./agents/CompetitionAgent.js";
import { HintAgent } from "./agents/HintAgent.js";
import {
  isAdmin,
  getTeamFromToken,
  errorResponse,
  jsonResponse,
  corsPreflightResponse,
} from "./lib/auth.js";
import {
  CHALLENGES,
  getAllPublicChallenges,
  getPublicChallenge,
} from "./lib/challenges.js";

// Re-export Durable Object classes — required by Cloudflare
export { ChallengeAgent, CompetitionAgent, HintAgent };

// ─── Helper: get the single CompetitionAgent instance ────────────────────────
function getCompetitionAgent(env) {
  const id = env.COMPETITION_AGENT.idFromName("global");
  return env.COMPETITION_AGENT.get(id);
}

// ─── Helper: get a ChallengeAgent by challenge id ────────────────────────────
function getChallengeAgent(env, challengeId) {
  const id = env.CHALLENGE_AGENT.idFromName(challengeId);
  return env.CHALLENGE_AGENT.get(id);
}

// ─── Helper: get a HintAgent (scoped to challenge + team) ────────────────────
function getHintAgent(env, challengeId, teamId) {
  const id = env.HINT_AGENT.idFromName(`hint-${challengeId}-${teamId}`);
  return env.HINT_AGENT.get(id);
}

// ─── Main fetch handler ───────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return corsPreflightResponse();
    }

    // ── Delegate WebSocket upgrade to Agents SDK ────────────────────────────
    // The Agents SDK handles WebSocket routing for HintAgent (AI chat)
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;

    // ── REST API routes ─────────────────────────────────────────────────────

    // GET /api/challenges — list all challenges (no flags)
    if (pathname === "/api/challenges" && request.method === "GET") {
      return jsonResponse(getAllPublicChallenges());
    }

    // GET /api/challenges/:id — single challenge (no flag)
    const challengeMatch = pathname.match(/^\/api\/challenges\/([^/]+)$/);
    if (challengeMatch && request.method === "GET") {
      const ch = getPublicChallenge(challengeMatch[1]);
      if (!ch) return errorResponse("Challenge not found", 404);
      return jsonResponse(ch);
    }

    // GET /api/scoreboard — live scoreboard
    if (pathname === "/api/scoreboard" && request.method === "GET") {
      const comp = getCompetitionAgent(env);
      const scoreboard = await comp.getScoreboard();
      return jsonResponse(scoreboard);
    }

    // POST /api/teams/register — register a new team
    if (pathname === "/api/teams/register" && request.method === "POST") {
      const { name, country } = await request.json();
      if (!name?.trim()) return errorResponse("name is required");

      const comp = getCompetitionAgent(env);
      const result = await comp.registerTeam(name.trim(), country || "🏳");
      if (result.error) return errorResponse(result.error, 409);

      return jsonResponse(result, 201);
    }

    // POST /api/challenges/:id/submit — submit a flag
    if (challengeMatch && request.method === "POST" && pathname.endsWith("/submit")) {
      const challengeId = pathname.split("/")[3];
      const team = await getTeamFromToken(request, env);
      if (!team) return errorResponse("Unauthorized — missing or invalid team token", 401);

      const challenge = CHALLENGES.find(c => c.id === challengeId);
      if (!challenge) return errorResponse("Challenge not found", 404);

      const { flag } = await request.json();
      if (!flag?.trim()) return errorResponse("flag is required");

      // Ask the ChallengeAgent to validate and record
      const agent  = getChallengeAgent(env, challengeId);
      const result = await agent.submitFlag(team.teamId, flag.trim(), challenge.flag);

      if (result.correct && !result.alreadySolved) {
        // Record the solve in CompetitionAgent (triggers WebSocket broadcast)
        const comp = getCompetitionAgent(env);
        await comp.recordSolve(team.teamId, challengeId, challenge.points);
      }

      return jsonResponse({
        correct:      result.correct,
        alreadySolved: result.alreadySolved || false,
        firstBlood:   result.firstBlood || false,
        points:       result.correct ? challenge.points : 0,
      });
    }

    // POST /api/challenges/:id/hint — initialise hint agent for this team
    const hintMatch = pathname.match(/^\/api\/challenges\/([^/]+)\/hint$/);
    if (hintMatch && request.method === "POST") {
      const challengeId = hintMatch[1];
      const team = await getTeamFromToken(request, env);
      if (!team) return errorResponse("Unauthorized", 401);

      const challenge = CHALLENGES.find(c => c.id === challengeId);
      if (!challenge) return errorResponse("Challenge not found", 404);

      // Get next hint index from ChallengeAgent
      const challengeAgent = getChallengeAgent(env, challengeId);
      const hintResult = await challengeAgent.requestHint(team.teamId, challenge.hints.length);
      if (hintResult.exhausted) {
        return jsonResponse({ exhausted: true, message: "All hints have been used." });
      }

      // Initialise the HintAgent with challenge context if not already done
      const hintAgent = getHintAgent(env, challengeId, team.teamId);
      await hintAgent.initChallenge({
        name:        challenge.name,
        category:    challenge.category,
        difficulty:  challenge.difficulty,
        description: challenge.description,
        hints:       challenge.hints,
        hintsUsed:   hintResult.index,
      });

      return jsonResponse({
        hintIndex:  hintResult.index,
        totalHints: challenge.hints.length,
        // Actual hint text served via HintAgent WebSocket chat
        agentUrl: `/agents/HintAgent/hint-${challengeId}-${team.teamId}`,
      });
    }

    // ── Admin routes (require ADMIN_SECRET) ─────────────────────────────────

    // GET /api/admin/challenges/:id/stats
    const adminStatsMatch = pathname.match(/^\/api\/admin\/challenges\/([^/]+)\/stats$/);
    if (adminStatsMatch && request.method === "GET") {
      if (!isAdmin(request, env)) return errorResponse("Forbidden", 403);
      const agent = getChallengeAgent(env, adminStatsMatch[1]);
      return jsonResponse(await agent.getStats());
    }

    // POST /api/admin/challenges/:id/reset
    const adminResetMatch = pathname.match(/^\/api\/admin\/challenges\/([^/]+)\/reset$/);
    if (adminResetMatch && request.method === "POST") {
      if (!isAdmin(request, env)) return errorResponse("Forbidden", 403);
      const agent = getChallengeAgent(env, adminResetMatch[1]);
      return jsonResponse(await agent.reset());
    }

    // GET /api/admin/teams
    if (pathname === "/api/admin/teams" && request.method === "GET") {
      if (!isAdmin(request, env)) return errorResponse("Forbidden", 403);
      const comp = getCompetitionAgent(env);
      return jsonResponse(await comp.getTeams());
    }

    // PUT /api/admin/competition — update competition settings
    if (pathname === "/api/admin/competition" && request.method === "PUT") {
      if (!isAdmin(request, env)) return errorResponse("Forbidden", 403);
      const body = await request.json();
      const comp = getCompetitionAgent(env);
      for (const [key, value] of Object.entries(body)) {
        await comp.setCompetitionValue(key, value);
      }
      return jsonResponse({ updated: true });
    }

    // WebSocket upgrade for scoreboard — forward to CompetitionAgent
    if (pathname === "/ws/scoreboard") {
      const team = await getTeamFromToken(request, env);
      const comp = getCompetitionAgent(env);
      // Pass team_id in URL so CompetitionAgent.onConnect can map it
      const wsUrl = new URL(request.url);
      if (team) wsUrl.searchParams.set("team_id", team.teamId);
      return comp.fetch(new Request(wsUrl, request));
    }

    return new Response("Not found", { status: 404 });
  },
};
