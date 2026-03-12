import { useState } from "react";
import { registerTeam } from "../lib/api.js";

const COUNTRIES = ["🇬🇧","🇺🇸","🇩🇪","🇫🇷","🇯🇵","🇧🇷","🇨🇦","🇦🇺","🇳🇱","🇸🇬","🏳"];

export default function RegisterModal({ onRegister }) {
  const [name,    setName]    = useState("");
  const [country, setCountry] = useState("🇬🇧");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const submit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await registerTeam(name.trim(), country);
      onRegister({ ...result, name: name.trim(), country });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.9)",
      zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: 380, background: "#0b0f14", border: "1px solid #1f2933",
        borderRadius: 8, padding: 32,
        boxShadow: "0 0 80px rgba(0,255,224,.07), 0 30px 60px rgba(0,0,0,.6)",
      }}>
        <div style={{ fontFamily: "monospace", fontSize: 10, color: "#00ffe0", letterSpacing: 3, marginBottom: 6 }}>
          ⬡ CTF//ORCH
        </div>
        <div style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 20, color: "#c8d6e5", marginBottom: 4 }}>
          Register Your Team
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: "#4a5568", marginBottom: 24 }}>
          Hack South West 2026
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: "monospace", fontSize: 9, color: "#4a5568", letterSpacing: 2, marginBottom: 6 }}>
            TEAM NAME
          </div>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="e.g. 0xDEADBEEF"
            style={{
              width: "100%", padding: "10px 14px", fontSize: 13,
              background: "#080c10", border: "1px solid #1f2933",
              borderRadius: 4, color: "#c8d6e5", fontFamily: "monospace",
              outline: "none",
            }}
          />
        </div>

        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: "monospace", fontSize: 9, color: "#4a5568", letterSpacing: 2, marginBottom: 6 }}>
            COUNTRY
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {COUNTRIES.map(c => (
              <button key={c} onClick={() => setCountry(c)} style={{
                fontSize: 18, background: country === c ? "rgba(0,255,224,.1)" : "none",
                border: `1px solid ${country === c ? "rgba(0,255,224,.3)" : "#1f2933"}`,
                borderRadius: 4, padding: "4px 8px", cursor: "pointer",
              }}>{c}</button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            marginBottom: 14, padding: "8px 12px", borderRadius: 4,
            background: "rgba(255,60,110,.1)", border: "1px solid rgba(255,60,110,.3)",
            fontFamily: "monospace", fontSize: 11, color: "#ff3c6e",
          }}>{error}</div>
        )}

        <button onClick={submit} disabled={loading || !name.trim()} style={{
          width: "100%", padding: 12, background: loading ? "#1f2933" : "#00ffe0",
          color: "#000", border: "none", borderRadius: 4,
          fontFamily: "monospace", fontSize: 12, fontWeight: 700, letterSpacing: 2,
        }}>
          {loading ? "REGISTERING..." : "JOIN COMPETITION →"}
        </button>
      </div>
    </div>
  );
}
