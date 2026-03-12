/**
 * api.js — centralised API client for the CTF Orchestrator frontend.
 * All calls go through these functions so the base URL is easy to change.
 */

const BASE = import.meta.env.VITE_API_URL || "";

function authHeaders(token) {
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Public ────────────────────────────────────────────────────────────────────

export const getChallenges = () =>
  fetch(`${BASE}/api/challenges`).then(handleResponse);

export const getScoreboard = () =>
  fetch(`${BASE}/api/scoreboard`).then(handleResponse);

export const registerTeam = (name, country) =>
  fetch(`${BASE}/api/teams/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, country }),
  }).then(handleResponse);

// ── Authenticated (team token required) ───────────────────────────────────────

export const submitFlag = (challengeId, flag, token) =>
  fetch(`${BASE}/api/challenges/${challengeId}/submit`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ flag }),
  }).then(handleResponse);

export const requestHint = (challengeId, token) =>
  fetch(`${BASE}/api/challenges/${challengeId}/hint`, {
    method: "POST",
    headers: authHeaders(token),
  }).then(handleResponse);

// ── Admin (admin secret required) ────────────────────────────────────────────

export const getAdminChallengeStats = (challengeId, adminSecret) =>
  fetch(`${BASE}/api/admin/challenges/${challengeId}/stats`, {
    headers: { Authorization: `Bearer ${adminSecret}` },
  }).then(handleResponse);

export const resetChallenge = (challengeId, adminSecret) =>
  fetch(`${BASE}/api/admin/challenges/${challengeId}/reset`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminSecret}` },
  }).then(handleResponse);

export const getAdminTeams = (adminSecret) =>
  fetch(`${BASE}/api/admin/teams`, {
    headers: { Authorization: `Bearer ${adminSecret}` },
  }).then(handleResponse);

export const updateCompetition = (settings, adminSecret) =>
  fetch(`${BASE}/api/admin/competition`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${adminSecret}`, "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  }).then(handleResponse);
