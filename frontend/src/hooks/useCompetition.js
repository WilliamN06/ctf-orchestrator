import { useState, useEffect, useCallback, useRef } from "react";
import { getChallenges, getScoreboard, submitFlag, requestHint } from "../lib/api.js";
import { useWebSocket } from "./useWebSocket.js";

/**
 * useCompetition — master state hook.
 *
 * Fetches challenges + scoreboard on mount.
 * Subscribes to live WebSocket events to keep scoreboard in sync.
 * Exposes actions: register, submitFlag, requestHint.
 */
export function useCompetition() {
  const [challenges,  setChallenges]  = useState([]);
  const [scoreboard,  setScoreboard]  = useState([]);
  const [feed,        setFeed]        = useState([]);
  const [team,        setTeam]        = useState(() => {
    try {
      const stored = localStorage.getItem("ctf_team");
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [loading,     setLoading]     = useState(true);
  const [ended,       setEnded]       = useState(false);
  const feedLimit = 30;

  // Push an event to the live feed
  const pushEvent = useCallback((type, msg) => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
    setFeed(f => [{ type, msg, time }, ...f.slice(0, feedLimit - 1)]);
  }, []);

  // Handle incoming WebSocket messages
  const handleWsEvent = useCallback((msg) => {
    switch (msg.type) {
      case "SCOREBOARD_INIT":
        setScoreboard(msg.scoreboard || []);
        break;

      case "SOLVE":
        setScoreboard(msg.scoreboard || []);
        pushEvent("solve", `${msg.country} ${msg.teamName} solved ${msg.challengeId} [+${msg.points}pts]`);
        // If it's our own team, mark challenge as solved locally
        if (team && msg.teamId === team.teamId) {
          setChallenges(cs => cs.map(c =>
            c.id === msg.challengeId ? { ...c, solved: true } : c
          ));
        }
        break;

      case "TEAM_JOINED":
        pushEvent("join", `${msg.country} ${msg.teamName} joined the competition`);
        break;

      case "COMPETITION_ENDED":
        setScoreboard(msg.finalScoreboard || []);
        setEnded(true);
        pushEvent("system", "Competition has ended — final results locked in");
        break;
    }
  }, [team, pushEvent]);

  const { connected } = useWebSocket(team?.token, handleWsEvent);

  // Initial data fetch
  useEffect(() => {
    Promise.all([getChallenges(), getScoreboard()])
      .then(([chs, sb]) => {
        setChallenges(chs.map(c => ({ ...c, solved: false })));
        setScoreboard(sb);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const saveTeam = useCallback((teamData) => {
    setTeam(teamData);
    try { localStorage.setItem("ctf_team", JSON.stringify(teamData)); } catch {}
  }, []);

  const logout = useCallback(() => {
    setTeam(null);
    try { localStorage.removeItem("ctf_team"); } catch {}
  }, []);

  const handleSubmitFlag = useCallback(async (challengeId, flag) => {
    if (!team) throw new Error("Not registered");
    const result = await submitFlag(challengeId, flag, team.token);
    if (result.correct && !result.alreadySolved) {
      setChallenges(cs => cs.map(c =>
        c.id === challengeId ? { ...c, solved: true } : c
      ));
      pushEvent("solve", `You solved ${challengeId} [+${result.points}pts]!`);
    }
    return result;
  }, [team, pushEvent]);

  const handleRequestHint = useCallback(async (challengeId) => {
    if (!team) throw new Error("Not registered");
    return requestHint(challengeId, team.token);
  }, [team]);

  return {
    challenges,
    scoreboard,
    feed,
    team,
    loading,
    ended,
    connected,
    saveTeam,
    logout,
    submitFlag:   handleSubmitFlag,
    requestHint:  handleRequestHint,
  };
}
