# API Reference

Base URL: `https://ctf-orchestrator.your-name.workers.dev`

All responses are JSON. Authenticated routes require `Authorization: Bearer <token>`.

---

## Public Routes

### `GET /api/challenges`
Returns all challenges without flags.

**Response:**
```json
[
  {
    "id": "stack-smasher",
    "name": "Stack Smasher",
    "category": "pwn",
    "difficulty": "easy",
    "points": 100,
    "description": "...",
    "hints": ["hint 1", "hint 2"],
    "files": ["vuln", "vuln.c"],
    "nc": "nc challenges.ctf.dev 9001"
  }
]
```

---

### `GET /api/challenges/:id`
Returns a single challenge without flag.

---

### `GET /api/scoreboard`
Returns the live scoreboard sorted by score descending.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "0xDEADBEEF",
    "country": "🇬🇧",
    "score": 1350,
    "last_solve": 1738000000000,
    "solve_count": 5
  }
]
```

---

## Team Routes (Bearer: team token)

### `POST /api/teams/register`
Register a new team. Returns a persistent token — store this.

**Body:**
```json
{ "name": "TeamName", "country": "🇬🇧" }
```

**Response:**
```json
{ "teamId": "uuid", "token": "uuid" }
```

---

### `POST /api/challenges/:id/submit`
Submit a flag attempt.

**Headers:** `Authorization: Bearer <team_token>`

**Body:**
```json
{ "flag": "CTF{...}" }
```

**Response:**
```json
{
  "correct": true,
  "firstBlood": false,
  "alreadySolved": false,
  "points": 100
}
```

---

### `POST /api/challenges/:id/hint`
Initialise a hint session for a challenge. Returns the HintAgent WebSocket URL.

**Headers:** `Authorization: Bearer <team_token>`

**Response:**
```json
{
  "hintIndex": 0,
  "totalHints": 3,
  "agentUrl": "/agents/HintAgent/hint-stack-smasher-<teamId>"
}
```

Then connect via WebSocket to `agentUrl` to chat with the AI hint agent.

---

## WebSocket

### `GET /ws/scoreboard`
Upgrade to WebSocket to receive live events.

**Optional header:** `Authorization: Bearer <team_token>` (maps connection to your team)

**Incoming message types:**

| Type | Payload |
|------|---------|
| `SCOREBOARD_INIT` | `{ scoreboard: [...] }` |
| `SOLVE` | `{ teamId, teamName, challengeId, points, newScore, scoreboard }` |
| `TEAM_JOINED` | `{ teamName, country }` |
| `COMPETITION_ENDED` | `{ finalScoreboard: [...] }` |

---

## Admin Routes (Bearer: ADMIN_SECRET)

### `GET /api/admin/challenges/:id/stats`
Returns attempt/solve statistics for a challenge from its Durable Object.

### `POST /api/admin/challenges/:id/reset`
Wipes all solves and attempts for a challenge.

### `GET /api/admin/teams`
Returns all registered teams.

### `PUT /api/admin/competition`
Update competition settings.

**Body:**
```json
{ "name": "Competition Name", "end_time": 1738000000000 }
```
