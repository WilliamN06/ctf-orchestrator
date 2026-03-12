import { useState, useCallback } from "react";
import { useCompetition } from "./hooks/useCompetition.js";
import { requestHint } from "./lib/api.js";
import RegisterModal from "./components/RegisterModal.jsx";
import HintChat from "./components/HintChat.jsx";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg: "#05070a", surface: "#0b0f14", border: "#161c24", border2: "#1f2933",
  accent: "#00ffe0", accent2: "#ff3c6e", gold: "#ffd166",
  text: "#c8d6e5", muted: "#4a5568",
};

const CAT = {
  pwn:       { color: "#ff3c6e", bg: "rgba(255,60,110,.12)"  },
  crypto:    { color: "#00ffe0", bg: "rgba(0,255,224,.10)"   },
  forensics: { color: "#a78bfa", bg: "rgba(167,139,250,.12)" },
  web:       { color: "#ffd166", bg: "rgba(255,209,102,.10)" },
  misc:      { color: "#60a5fa", bg: "rgba(96,165,250,.12)"  },
  rev:       { color: "#fb923c", bg: "rgba(251,146,60,.12)"  },
};

const DIFF = { easy: "#22c55e", medium: "#ffd166", hard: "#ff3c6e", insane: "#a78bfa" };

// ─── Tiny shared atoms ────────────────────────────────────────────────────────
const Tag = ({ c, bg, children }) => (
  <span style={{
    display: "inline-block", fontSize: 9, fontFamily: "monospace",
    letterSpacing: 1, padding: "2px 8px", borderRadius: 3,
    color: c, background: bg, border: `1px solid ${c}33`,
  }}>{children}</span>
);

function fmtTime(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

// ─── FlagModal ────────────────────────────────────────────────────────────────
function FlagModal({ challenge, onClose, onSubmit }) {
  const [flag,   setFlag]   = useState("");
  const [result, setResult] = useState(null);
  const [loading,setLoading]= useState(false);
  const [shake,  setShake]  = useState(false);

  const submit = async () => {
    if (!flag.trim() || loading) return;
    setLoading(true);
    try {
      const r = await onSubmit(challenge.id, flag.trim());
      setResult(r);
      if (!r.correct) { setShake(true); setTimeout(() => setShake(false), 500); }
      else setTimeout(onClose, 1400);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{`@keyframes sh{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}`}</style>
      <div style={{
        width: 420, background: T.surface, border: `1px solid ${T.border2}`,
        borderRadius: 8, padding: 24,
        animation: shake ? "sh .4s ease" : "none",
        boxShadow: result?.correct ? "0 0 60px rgba(34,197,94,.25)" : "0 30px 60px rgba(0,0,0,.5)",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
          {CAT[challenge.category] &&
            <Tag c={CAT[challenge.category].color} bg={CAT[challenge.category].bg}>
              {challenge.category.toUpperCase()}
            </Tag>}
          <span style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 15, color: T.text }}>
            {challenge.name}
          </span>
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 20, color: T.accent, marginBottom: 18 }}>
          {challenge.points} pts
        </div>
        <input
          autoFocus value={flag} onChange={e => { setFlag(e.target.value); setResult(null); }}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="CTF{...}"
          style={{
            width: "100%", padding: "10px 14px", fontSize: 13, borderRadius: 4, marginBottom: 12,
            background: T.bg, border: `1px solid ${result?.correct ? "#22c55e" : result?.correct === false ? T.accent2 : T.border2}`,
            color: T.text, fontFamily: "monospace", outline: "none",
          }}
        />
        {result && (
          <div style={{
            marginBottom: 12, padding: "8px 12px", borderRadius: 4,
            fontFamily: "monospace", fontSize: 12, letterSpacing: 1,
            background: result.correct ? "rgba(34,197,94,.12)" : "rgba(255,60,110,.12)",
            color: result.correct ? "#22c55e" : T.accent2,
            border: `1px solid ${result.correct ? "#22c55e33" : T.accent2 + "33"}`,
          }}>
            {result.correct
              ? result.firstBlood ? "🩸 FIRST BLOOD! CORRECT FLAG" : "✓ CORRECT FLAG — SOLVED"
              : result.alreadySolved ? "ALREADY SOLVED" : result.error || "✗ INCORRECT FLAG"}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={submit} disabled={loading || !flag.trim()} style={{
            flex: 1, background: T.accent, color: "#000", border: "none",
            borderRadius: 4, padding: 10, fontFamily: "monospace",
            fontSize: 12, letterSpacing: 1, fontWeight: 700,
          }}>SUBMIT FLAG</button>
          <button onClick={onClose} style={{
            background: "none", border: `1px solid ${T.border2}`, color: T.muted,
            borderRadius: 4, padding: "10px 16px", fontFamily: "monospace", fontSize: 12,
          }}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

// ─── ChallengeCard ────────────────────────────────────────────────────────────
function ChallengeCard({ ch, onFlag, onHint, idx }) {
  const cat = CAT[ch.category] || CAT.misc;
  const pct = Math.round((ch.solveCount / 120) * 100);
  return (
    <div style={{
      background: ch.solved ? "rgba(34,197,94,.04)" : T.surface,
      border: `1px solid ${ch.solved ? "rgba(34,197,94,.25)" : T.border}`,
      borderRadius: 6, padding: 18,
      display: "flex", flexDirection: "column", gap: 12,
      animation: "fadeUp .35s ease both",
      animationDelay: `${idx * 40}ms`,
    }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <Tag c={cat.color} bg={cat.bg}>{ch.category.toUpperCase()}</Tag>
          <Tag c={DIFF[ch.difficulty]} bg={DIFF[ch.difficulty] + "18"}>{ch.difficulty.toUpperCase()}</Tag>
        </div>
        {ch.solved && <span style={{ fontFamily: "monospace", fontSize: 9, color: "#22c55e", letterSpacing: 2 }}>✓ SOLVED</span>}
      </div>

      <div>
        <div style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 5 }}>
          {ch.name}
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
          {ch.description?.slice(0, 90)}...
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontFamily: "monospace", fontSize: 22, color: T.accent, fontWeight: 700 }}>
          {ch.points}<span style={{ fontSize: 11, color: T.muted, marginLeft: 4 }}>pts</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "monospace", fontSize: 9, color: T.muted, marginBottom: 4 }}>
            {ch.solveCount ?? 0} solves ({pct}%)
          </div>
          <div style={{ width: 70, height: 2, background: T.border }}>
            <div style={{ width: `${pct}%`, height: "100%", background: cat.color }} />
          </div>
        </div>
      </div>

      {(ch.files?.length > 0 || ch.nc) && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {ch.files?.map(f => (
            <span key={f} style={{
              fontFamily: "monospace", fontSize: 9, color: T.muted,
              background: T.bg, border: `1px solid ${T.border}`, padding: "2px 7px", borderRadius: 2,
            }}>📎 {f}</span>
          ))}
          {ch.nc && (
            <span style={{
              fontFamily: "monospace", fontSize: 9, color: T.accent,
              background: "rgba(0,255,224,.06)", border: "1px solid rgba(0,255,224,.15)",
              padding: "2px 7px", borderRadius: 2,
            }}>🌐 {ch.nc.startsWith("nc") ? ch.nc : "web challenge"}</span>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {ch.solved ? (
          <div style={{
            flex: 1, textAlign: "center", fontFamily: "monospace", fontSize: 11,
            color: "#22c55e", padding: 8,
            background: "rgba(34,197,94,.06)", border: "1px solid rgba(34,197,94,.15)", borderRadius: 4,
          }}>✓ COMPLETE</div>
        ) : (
          <button onClick={() => onFlag(ch)} style={{
            flex: 1, background: T.accent, color: "#000", border: "none",
            borderRadius: 4, padding: 8, fontFamily: "monospace", fontSize: 11, fontWeight: 700,
          }}>SUBMIT FLAG</button>
        )}
        {!ch.solved && ch.hints?.length > 0 && (
          <button onClick={() => onHint(ch)} style={{
            background: "none", border: `1px solid ${T.border2}`, color: T.muted,
            borderRadius: 4, padding: "8px 14px", fontFamily: "monospace", fontSize: 11,
          }}>HINT</button>
        )}
      </div>
    </div>
  );
}

// ─── Root App ────────────────────────────────────────────────────────────────
export default function App() {
  const {
    challenges, scoreboard, feed, team, loading,
    ended, connected, saveTeam, logout, submitFlag,
  } = useCompetition();

  const [view,       setView]       = useState("challenges");
  const [filter,     setFilter]     = useState("all");
  const [flagModal,  setFlagModal]  = useState(null);
  const [hintModal,  setHintModal]  = useState(null);
  const [hintAgent,  setHintAgent]  = useState(null); // { agentUrl, challenge }
  const [showReg,    setShowReg]    = useState(false);
  const [timeLeft,   setTimeLeft]   = useState(9 * 3600 + 44 * 60);

  // Countdown timer
  useState(() => {
    const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const handleHint = useCallback(async (challenge) => {
    if (!team) { setShowReg(true); return; }
    try {
      const result = await requestHint(challenge.id, team.token);
      setHintModal(challenge);
      if (result.agentUrl) setHintAgent({ agentUrl: result.agentUrl, challenge });
      else setHintAgent({ agentUrl: null, challenge });
    } catch {
      setHintModal(challenge);
      setHintAgent({ agentUrl: null, challenge });
    }
  }, [team]);

  const cats = ["all", ...Object.keys(CAT)];
  const filtered = challenges.filter(c => filter === "all" || c.category === filter);
  const sorted   = [...scoreboard].sort((a, b) => b.score - a.score || a.last_solve - b.last_solve);
  const maxScore = sorted[0]?.score || 1;
  const yourEntry = sorted.find(t => t.id === team?.teamId);
  const yourRank  = sorted.findIndex(t => t.id === team?.teamId) + 1;

  if (loading) return (
    <div style={{ height: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "monospace", color: T.muted, fontSize: 12, letterSpacing: 3 }}>
        LOADING CHALLENGES...
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;600;700&display=swap');
        body { font-family: 'Rajdhani', sans-serif; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, textarea { font-family: 'Share Tech Mono', monospace; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #1f2933; }
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
      `}</style>

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(5,7,10,.94)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 52,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "monospace", fontSize: 13, color: T.accent, letterSpacing: 3 }}>⬡ CTF//ORCH</span>
          {ended && <Tag c={T.accent2} bg="rgba(255,60,110,.1)">ENDED</Tag>}
        </div>
        <div style={{ display: "flex" }}>
          {["challenges", "scoreboard"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: "none", border: "none",
              borderBottom: `2px solid ${view === v ? T.accent : "transparent"}`,
              color: view === v ? T.accent : T.muted,
              padding: "0 18px", height: 52, fontFamily: "monospace",
              fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
            }}>{v}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "#22c55e" : T.accent2, display: "inline-block", animation: "pulse 2s infinite" }} />
            <span style={{ fontFamily: "monospace", fontSize: 9, color: connected ? "#22c55e" : T.accent2 }}>
              {connected ? "LIVE" : "OFFLINE"}
            </span>
          </div>
          <div style={{
            background: T.surface, border: `1px solid ${T.border2}`,
            borderRadius: 4, padding: "4px 12px",
            fontFamily: "monospace", fontSize: 14, letterSpacing: 3,
            color: timeLeft < 3600 ? T.accent2 : T.accent,
          }}>{fmtTime(timeLeft)}</div>
          {team ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: T.accent }}>{team.name}</span>
              {yourRank > 0 && <Tag c={T.muted} bg="transparent">#{yourRank}</Tag>}
              <button onClick={logout} style={{
                background: "none", border: `1px solid ${T.border2}`, color: T.muted,
                borderRadius: 3, padding: "3px 10px", fontFamily: "monospace", fontSize: 9,
              }}>LOGOUT</button>
            </div>
          ) : (
            <button onClick={() => setShowReg(true)} style={{
              background: T.accent, color: "#000", border: "none",
              borderRadius: 4, padding: "6px 14px", fontFamily: "monospace",
              fontSize: 11, fontWeight: 700, letterSpacing: 1,
            }}>REGISTER</button>
          )}
        </div>
      </nav>

      {/* Stat bar */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)",
        background: T.surface, borderBottom: `1px solid ${T.border}`,
      }}>
        {[
          { label: "TEAMS",      value: scoreboard.length,       sub: "registered" },
          { label: "CHALLENGES", value: challenges.length,        sub: `${challenges.filter(c => c.solved).length} solved by you` },
          { label: "YOUR RANK",  value: yourRank > 0 ? `#${yourRank}` : "—", sub: `of ${scoreboard.length}` },
          { label: "YOUR SCORE", value: yourEntry?.score ?? 0,   sub: "points" },
        ].map((s, i) => (
          <div key={i} style={{ padding: "12px 24px", borderRight: i < 3 ? `1px solid ${T.border}` : "none" }}>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: T.muted, letterSpacing: 2, marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: T.text }}>{s.value}</div>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: T.muted, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div style={{ display: "flex" }}>
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, padding: 24 }}>

          {view === "challenges" && (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
                {cats.map(c => (
                  <button key={c} onClick={() => setFilter(c)} style={{
                    background: filter === c ? T.accent : "none",
                    color: filter === c ? "#000" : T.muted,
                    border: `1px solid ${filter === c ? T.accent : T.border2}`,
                    borderRadius: 3, padding: "4px 12px",
                    fontFamily: "monospace", fontSize: 10, letterSpacing: 1,
                  }}>{c.toUpperCase()}</button>
                ))}
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 14,
              }}>
                {filtered.map((ch, i) => (
                  <ChallengeCard
                    key={ch.id} ch={ch} idx={i}
                    onFlag={ch => { if (!team) { setShowReg(true); return; } setFlagModal(ch); }}
                    onHint={handleHint}
                  />
                ))}
              </div>
            </>
          )}

          {view === "scoreboard" && (
            <div>
              <div style={{ fontFamily: "monospace", fontSize: 9, color: T.muted, letterSpacing: 2, marginBottom: 16 }}>
                LIVE SCOREBOARD · DURABLE OBJECT WEBSOCKET
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {sorted.map((t, i) => {
                  const isYou = t.id === team?.teamId;
                  const bar   = (t.score / maxScore) * 100;
                  return (
                    <div key={t.id} style={{
                      background: isYou ? "rgba(0,255,224,.04)" : T.surface,
                      border: `1px solid ${isYou ? "rgba(0,255,224,.2)" : T.border}`,
                      borderRadius: 4, position: "relative", overflow: "hidden",
                      animation: "fadeUp .3s ease both", animationDelay: `${i * 25}ms`,
                    }}>
                      <div style={{
                        position: "absolute", left: 0, top: 0, bottom: 0,
                        width: `${bar}%`, background: "rgba(255,255,255,.015)",
                        transition: "width .6s ease",
                      }} />
                      <div style={{
                        position: "relative", padding: "11px 18px",
                        display: "grid",
                        gridTemplateColumns: "44px 1fr 90px 80px",
                        alignItems: "center", gap: 10,
                      }}>
                        <div style={{
                          fontFamily: "monospace", fontSize: 16, fontWeight: 700,
                          color: i < 3 ? ["#ffd700","#c0c0c0","#cd7f32"][i] : T.muted,
                        }}>#{i + 1}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 15 }}>{t.country}</span>
                          <span style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 14, color: isYou ? T.accent : T.text }}>
                            {t.name}
                          </span>
                          {isYou && <Tag c={T.accent} bg="rgba(0,255,224,.08)">YOU</Tag>}
                        </div>
                        <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 11, color: T.muted }}>
                          {t.solve_count} solves
                        </div>
                        <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 17, fontWeight: 700, color: isYou ? T.accent : T.text }}>
                          {t.score}<span style={{ fontSize: 9, color: T.muted, marginLeft: 3 }}>pts</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Live feed sidebar */}
        <div style={{
          width: 250, flexShrink: 0, background: T.surface,
          borderLeft: `1px solid ${T.border}`,
          height: "calc(100vh - 106px)", position: "sticky", top: 106, overflowY: "auto",
        }}>
          <div style={{
            padding: "11px 14px", borderBottom: `1px solid ${T.border}`,
            fontFamily: "monospace", fontSize: 9, color: T.muted, letterSpacing: 2,
          }}>LIVE FEED</div>
          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
            {feed.map((e, i) => (
              <div key={i} style={{
                padding: "8px 10px", borderRadius: 4,
                background: "rgba(255,255,255,.02)", border: `1px solid ${T.border}`,
                opacity: Math.max(0.25, 1 - i * 0.06),
              }}>
                <div style={{ fontFamily: "monospace", fontSize: 8, color: T.muted, marginBottom: 2 }}>{e.time}</div>
                <div style={{
                  fontFamily: "monospace", fontSize: 10, lineHeight: 1.5,
                  color: e.type === "solve" ? "#22c55e" : e.type === "hint" ? T.accent : e.type === "join" ? T.gold : T.muted,
                }}>{e.msg}</div>
              </div>
            ))}
            {feed.length === 0 && (
              <div style={{ fontFamily: "monospace", fontSize: 10, color: T.muted, padding: 10 }}>
                waiting for events...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showReg  && <RegisterModal onRegister={(t) => { saveTeam(t); setShowReg(false); }} />}
      {flagModal && <FlagModal challenge={flagModal} onClose={() => setFlagModal(null)} onSubmit={submitFlag} />}
      {hintModal && hintAgent && (
        <HintChat
          challenge={hintAgent.challenge}
          agentUrl={hintAgent.agentUrl}
          staticHints={hintModal.hints || []}
          onClose={() => { setHintModal(null); setHintAgent(null); }}
        />
      )}
    </div>
  );
}
