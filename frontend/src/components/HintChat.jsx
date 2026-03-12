import { useState, useEffect, useRef } from "react";

const COLORS = {
  bg: "#05070a", surface: "#0b0f14", border: "#1f2933",
  accent: "#00ffe0", muted: "#4a5568", text: "#c8d6e5", accent2: "#ff3c6e",
};

/**
 * HintChat — connects to the HintAgent Durable Object WebSocket.
 *
 * Flow:
 *  1. Parent calls POST /api/challenges/:id/hint to initialise the DO and get agentUrl
 *  2. This component opens a WebSocket to agentUrl (Agents SDK chat protocol)
 *  3. Messages are streamed back from the Workers AI llama model
 *  4. Falls back to static hints if agentUrl is not available
 */
export default function HintChat({ challenge, agentUrl, staticHints = [], onClose }) {
  const [messages, setMessages] = useState([{
    role: "assistant",
    text: `Hint agent ready for **${challenge.name}**. Tell me where you're stuck.`,
  }]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [hintsUsed,setHintsUsed]= useState(0);
  const wsRef    = useRef(null);
  const bottomRef= useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Connect to the HintAgent WebSocket (Agents SDK protocol)
  useEffect(() => {
    if (!agentUrl) return;

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url   = `${proto}://${window.location.host}${agentUrl}`;
    const socket = new WebSocket(url);
    wsRef.current = socket;

    socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        // Agents SDK streams chunks with type "text-delta"
        if (data.type === "text-delta") {
          setMessages(msgs => {
            const last = msgs[msgs.length - 1];
            if (last?.role === "assistant" && last.streaming) {
              return [...msgs.slice(0, -1), { ...last, text: last.text + data.textDelta }];
            }
            return [...msgs, { role: "assistant", text: data.textDelta, streaming: true }];
          });
        }
        if (data.type === "finish") {
          setMessages(msgs => {
            const last = msgs[msgs.length - 1];
            if (last?.streaming) return [...msgs.slice(0, -1), { ...last, streaming: false }];
            return msgs;
          });
          setLoading(false);
        }
      } catch { /* ignore */ }
    };

    socket.onerror = () => {
      setMessages(m => [...m, {
        role: "assistant",
        text: "Connection error — falling back to static hints.",
      }]);
      setLoading(false);
    };

    return () => socket.close();
  }, [agentUrl]);

  const sendMessage = (text) => {
    if (!text.trim() || loading) return;
    setMessages(m => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Agents SDK chat message format
      wsRef.current.send(JSON.stringify({ type: "human", text }));
    } else {
      // Static fallback
      setTimeout(() => {
        const hint = staticHints[hintsUsed];
        const reply = hint
          ? `💡 **Hint ${hintsUsed + 1}/${staticHints.length}:** ${hint}`
          : "You've used all available hints. Review your approach and trust your skills.";
        setMessages(m => [...m, { role: "assistant", text: reply }]);
        if (hint) setHintsUsed(h => h + 1);
        setLoading(false);
      }, 700);
    }
  };

  const renderText = (text) =>
    text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.*?)`/g,
        `<code style="background:#0d1117;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:11px;color:${COLORS.accent}">$1</code>`
      );

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.82)",
      zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: 520, maxHeight: "88vh", background: COLORS.surface,
        border: `1px solid ${COLORS.border}`, borderRadius: 8,
        display: "flex", flexDirection: "column",
        boxShadow: "0 0 80px rgba(0,255,224,.05), 0 30px 60px rgba(0,0,0,.5)",
        animation: "fadeUp .3s ease",
      }}>
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

        {/* Header */}
        <div style={{
          padding: "13px 18px", borderBottom: `1px solid ${COLORS.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div>
            <div style={{
              fontFamily: "monospace", fontSize: 10, color: COLORS.accent,
              letterSpacing: 2, marginBottom: 3,
            }}>
              ⬡ HINT AGENT · {agentUrl ? "WORKERS AI CONNECTED" : "STATIC MODE"}
            </div>
            <div style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 14, color: COLORS.text }}>
              {challenge.name}
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: COLORS.muted, marginTop: 2 }}>
              {hintsUsed}/{staticHints.length} hints used
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: `1px solid ${COLORS.border}`,
            color: COLORS.muted, borderRadius: 4, padding: "4px 12px",
            fontFamily: "monospace", fontSize: 10,
          }}>ESC</button>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "16px 18px",
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "88%",
              background: m.role === "user" ? "rgba(0,255,224,.07)" : "rgba(255,255,255,.03)",
              border: `1px solid ${m.role === "user" ? "rgba(0,255,224,.2)" : COLORS.border}`,
              borderRadius: m.role === "user" ? "8px 8px 2px 8px" : "2px 8px 8px 8px",
              padding: "10px 14px",
            }}>
              <div style={{
                fontFamily: "monospace", fontSize: 9, color: COLORS.muted,
                marginBottom: 5, letterSpacing: 1,
              }}>
                {m.role === "user" ? "YOU" : "HINT AGENT"}
                {m.streaming && " ▋"}
              </div>
              <div
                style={{ fontSize: 13, color: m.role === "user" ? "rgba(0,255,224,.9)" : COLORS.text, lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{ __html: renderText(m.text) }}
              />
            </div>
          ))}
          {loading && !messages[messages.length - 1]?.streaming && (
            <div style={{ fontFamily: "monospace", fontSize: 11, color: COLORS.muted }}>
              thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Hint usage bar */}
        <div style={{ padding: "0 18px 8px" }}>
          <div style={{ height: 2, background: COLORS.border, borderRadius: 1 }}>
            <div style={{
              height: "100%", background: COLORS.accent, borderRadius: 1,
              width: `${staticHints.length > 0 ? (hintsUsed / staticHints.length) * 100 : 0}%`,
              transition: "width .4s",
            }} />
          </div>
        </div>

        {/* Input */}
        <div style={{
          padding: "12px 18px", borderTop: `1px solid ${COLORS.border}`,
          display: "flex", gap: 8,
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder="What are you stuck on?"
            style={{
              flex: 1, padding: "9px 14px", fontSize: 12, borderRadius: 4,
              background: COLORS.bg, border: `1px solid ${COLORS.border}`,
              color: COLORS.text, fontFamily: "monospace",
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? COLORS.border : COLORS.accent,
              color: "#000", border: "none", borderRadius: 4,
              padding: "9px 18px", fontFamily: "monospace",
              fontSize: 11, fontWeight: 700, letterSpacing: 1,
            }}
          >SEND</button>
        </div>
      </div>
    </div>
  );
}
