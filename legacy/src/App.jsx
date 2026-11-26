import { useState, useEffect, useCallback } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import ChallengesView from "./views/ChallengesView";
import ScoreboardView from "./views/ScoreboardView";
import AdminView from "./views/AdminView";
import HintModal from "./components/HintModal";
import FlagModal from "./components/FlagModal";
import { INITIAL_CHALLENGES, INITIAL_TEAMS } from "./data/initialData";
import "./styles/global.css";

export default function App() {
  const [view, setView] = useState("challenges");
  const [challenges, setChallenges] = useState(INITIAL_CHALLENGES);
  const [teams, setTeams] = useState(INITIAL_TEAMS);
  const [solved, setSolved] = useState(new Set([1, 6]));
  const [hintTarget, setHintTarget] = useState(null);
  const [flagTarget, setFlagTarget] = useState(null);
  const [feed, setFeed] = useState([
    { id: 1, type: "solve", msg: "0xDEADBEEF solved JWT Jailbreak", time: "14:32:01", pts: 300 },
    { id: 2, type: "hint", msg: "NullPointers requested hint on Kernel Panic", time: "14:28:44" },
    { id: 3, type: "solve", msg: "SegFault Society solved RSA? More like RSB", time: "14:21:09", pts: 250 },
    { id: 4, type: "system", msg: "Competition resets in 2h 44m", time: "14:02:17" },
    { id: 5, type: "solve", msg: "RootKit Rangers solved Buffer Overflow 101", time: "13:55:00", pts: 100 },
  ]);
  const [timeLeft, setTimeLeft] = useState(9841);
  const [feedId, setFeedId] = useState(100);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const addFeedEvent = useCallback((event) => {
    setFeedId(id => {
      const newId = id + 1;
      setFeed(f => [{ id: newId, ...event }, ...f.slice(0, 19)]);
      return newId;
    });
  }, []);

  const handleSolve = useCallback((challengeId, flag) => {
    const ch = challenges.find(c => c.id === challengeId);
    if (!ch) return false;
    if (flag !== ch.flag) return false;

    setSolved(s => new Set([...s, challengeId]));
    setChallenges(prev => prev.map(c =>
      c.id === challengeId ? { ...c, solves: c.solves + 1 } : c
    ));
    setTeams(prev => prev.map(t =>
      t.isYou ? { ...t, score: t.score + ch.points, solves: t.solves + 1, lastSolve: "just now" } : t
    ));
    addFeedEvent({
      type: "solve",
      msg: `WilliamN06 solved ${ch.name}`,
      time: new Date().toTimeString().slice(0, 8),
      pts: ch.points,
    });
    return true;
  }, [challenges, addFeedEvent]);

  const handleAddChallenge = useCallback((ch) => {
    setChallenges(prev => [...prev, { ...ch, id: Date.now(), solves: 0 }]);
    addFeedEvent({ type: "system", msg: `New challenge added: ${ch.name}`, time: new Date().toTimeString().slice(0, 8) });
  }, [addFeedEvent]);

  const handleDeleteChallenge = useCallback((id) => {
    setChallenges(prev => prev.filter(c => c.id !== id));
  }, []);

  return (
    <div className="app">
      <Header timeLeft={timeLeft} teams={teams} />
      <div className="layout">
        <Sidebar view={view} setView={setView} feed={feed} />
        <main className="main-content">
          {view === "challenges" && (
            <ChallengesView
              challenges={challenges}
              solved={solved}
              onHint={setHintTarget}
              onFlag={setFlagTarget}
            />
          )}
          {view === "scoreboard" && <ScoreboardView teams={teams} />}
          {view === "admin" && (
            <AdminView
              challenges={challenges}
              onAdd={handleAddChallenge}
              onDelete={handleDeleteChallenge}
            />
          )}
        </main>
      </div>

      {hintTarget && (
        <HintModal challenge={hintTarget} onClose={() => setHintTarget(null)} />
      )}
      {flagTarget && (
        <FlagModal
          challenge={flagTarget}
          solved={solved.has(flagTarget.id)}
          onSubmit={(flag) => handleSolve(flagTarget.id, flag)}
          onClose={() => setFlagTarget(null)}
        />
      )}
    </div>
  );
}
