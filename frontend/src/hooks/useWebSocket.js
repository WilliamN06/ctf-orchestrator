import { useEffect, useRef, useCallback, useState } from "react";

/**
 * useWebSocket — connects to the CompetitionAgent WebSocket for live updates.
 *
 * Handles:
 *  - Initial scoreboard state on connect
 *  - SOLVE events → updates scoreboard + adds to event feed
 *  - TEAM_JOINED events → adds to feed
 *  - COMPETITION_ENDED → sets ended state
 *  - Auto-reconnect on disconnect (exponential backoff, max 30s)
 */
export function useWebSocket(token, onEvent) {
  const ws        = useRef(null);
  const retryMs   = useRef(1000);
  const unmounted = useRef(false);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (unmounted.current) return;

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url   = `${proto}://${window.location.host}/ws/scoreboard${
      token ? `?token=${encodeURIComponent(token)}` : ""
    }`;

    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      retryMs.current = 1000;
    };

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        onEvent(msg);
      } catch {
        // ignore malformed messages
      }
    };

    socket.onclose = () => {
      setConnected(false);
      if (!unmounted.current) {
        setTimeout(connect, retryMs.current);
        retryMs.current = Math.min(retryMs.current * 2, 30_000);
      }
    };

    socket.onerror = () => socket.close();
  }, [token, onEvent]);

  useEffect(() => {
    connect();
    return () => {
      unmounted.current = true;
      ws.current?.close();
    };
  }, [connect]);

  return { connected };
}
