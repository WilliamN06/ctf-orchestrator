/**
 * Auth helpers for the CTF Orchestrator Worker.
 */

/**
 * Verify the admin Bearer token from the Authorization header.
 * Returns true if valid.
 */
export function isAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  return token === env.ADMIN_SECRET;
}

/**
 * Extract and validate a team token from the Authorization header.
 * Returns { teamId, name } if valid, or null.
 */
export async function getTeamFromToken(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return null;

  const compId = env.competitionAgent.idFromName("global");
  const comp   = env.COMPETITION_AGENT.get(compId);
  return await comp.validateToken(token);
}

/**
 * Standard JSON error response.
 */
export function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Standard JSON success response with CORS headers.
 */
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * CORS preflight response.
 */
export function corsPreflightResponse() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
