/**
 * challenges.js — source of truth for all challenge definitions.
 *
 * In production you'd store these in a KV namespace or D1 database
 * so admins can add/edit without redeploying. For now, define them here.
 *
 * Each challenge has:
 *  - id:          unique string used as Durable Object name
 *  - name:        display name
 *  - category:    pwn | crypto | web | forensics | misc | rev
 *  - difficulty:  easy | medium | hard | insane
 *  - points:      score awarded on solve
 *  - description: shown to competitors
 *  - flag:        correct flag — NEVER sent to frontend
 *  - hints:       ordered array of hint strings (served by HintAgent)
 *  - files:       list of filenames available to download
 *  - nc:          netcat command or URL if applicable
 */
export const CHALLENGES = [
  {
    id: "stack-smasher",
    name: "Stack Smasher",
    category: "pwn",
    difficulty: "easy",
    points: 100,
    description:
      "A classic buffer overflow. The binary reads user input with gets(). " +
      "Find the return address offset and redirect execution to win().",
    flag: "CTF{g0t_r00t_y3t}",
    hints: [
      "Use GDB to find the offset between buffer start and saved RIP.",
      "The pattern offset is exactly 72 bytes before the return address.",
      "win() is at 0x401196 — overwrite RIP with that address.",
    ],
    files: ["vuln", "vuln.c"],
    nc: "nc challenges.ctf.dev 9001",
  },
  {
    id: "tiny-exponent",
    name: "Tiny Exponent",
    category: "crypto",
    difficulty: "medium",
    points: 250,
    description:
      "RSA with e=3 and no padding. Three different public keys all encrypt " +
      "the same message. Something smells off.",
    flag: "CTF{h4s73d_cub3_r00t}",
    hints: [
      "When e=3 and the same plaintext is sent to 3 different keys, the Chinese Remainder Theorem applies.",
      "Hastad's broadcast attack: recover M³ mod (n1·n2·n3), then take the integer cube root.",
      "Use gmpy2.iroot(m_cubed, 3) for the exact integer cube root in Python.",
    ],
    files: ["output.txt", "gen.py"],
    nc: null,
  },
  {
    id: "pixel-secrets",
    name: "Pixel Secrets",
    category: "forensics",
    difficulty: "easy",
    points: 150,
    description:
      "This image looks normal. But there's something hiding in the least significant bits.",
    flag: "CTF{l5b_g035_brrrr}",
    hints: [
      "Try zsteg or stegsolve on the PNG.",
      "Check the LSB plane of the red channel specifically.",
    ],
    files: ["image.png"],
    nc: null,
  },
  {
    id: "jwt-confusion",
    name: "JWT Confusion",
    category: "web",
    difficulty: "hard",
    points: 300,
    description:
      "The server accepts RS256-signed JWTs. The public key is exposed at /pubkey. " +
      "Can you forge an admin token?",
    flag: "CTF{alg_n0ne_0r_hs256}",
    hints: [
      "What happens if you change the alg header from RS256 to HS256?",
      "The server uses the public key as the HMAC secret when alg=HS256 — algorithm confusion.",
      "Sign a forged JWT with HMAC-SHA256 using the PEM public key bytes as the secret.",
    ],
    files: ["app.py"],
    nc: "https://jwt-confusion.ctf.dev",
  },
  {
    id: "kernel-escape",
    name: "Kernel Escape",
    category: "pwn",
    difficulty: "insane",
    points: 500,
    description:
      "A custom kernel module with a race condition. Exploit it to escalate " +
      "from user to root inside the provided VM.",
    flag: "CTF{r1ng0_g0ne_wr0ng}",
    hints: [
      "The race condition is in the ioctl handler between the capability check and the memory operation.",
      "Use userfaultfd to pause kernel execution mid-race and win the TOCTOU reliably.",
    ],
    files: ["vuln.ko", "bzImage", "rootfs.cpio"],
    nc: null,
  },
  {
    id: "caesar-who",
    name: "Caesar Who?",
    category: "crypto",
    difficulty: "easy",
    points: 50,
    description: "Ycf{j1hv_4_pvbmzr_j1ar}. You know what to do.",
    flag: "CTF{r0ck_4_cipher_r0ce}",
    hints: ["ROT13 isn't quite right. Try every possible shift value."],
    files: [],
    nc: null,
  },
  {
    id: "sql-spelunking",
    name: "SQL Spelunking",
    category: "web",
    difficulty: "medium",
    points: 200,
    description:
      "A login form. The admin password is the flag. No WAF. Have fun.",
    flag: "CTF{un10n_s3l3ct_ftw}",
    hints: [
      "Classic UNION-based injection. Find the number of columns first.",
      "Try: ' UNION SELECT NULL,NULL-- to probe column count.",
      "Extract: ' UNION SELECT username,password FROM users--",
    ],
    files: ["app.py", "schema.sql"],
    nc: "https://sql-spelunking.ctf.dev",
  },
  {
    id: "heap-feng-shui",
    name: "Heap Feng Shui",
    category: "pwn",
    difficulty: "hard",
    points: 400,
    description:
      "tcache bin corruption in a custom allocator. Forge a chunk to get arbitrary write.",
    flag: "CTF{h34p_m4st3r_fl3x}",
    hints: [
      "Double-free a tcache chunk to corrupt the fd pointer.",
      "Point fd at __free_hook and overwrite it with system.",
    ],
    files: ["heap", "heap.c", "libc.so.6"],
    nc: "nc challenges.ctf.dev 9002",
  },
];

/** Get a challenge by id, without the flag (safe to send to frontend) */
export function getPublicChallenge(id) {
  const ch = CHALLENGES.find(c => c.id === id);
  if (!ch) return null;
  const { flag, ...safe } = ch;
  return safe;
}

/** Get all challenges without flags */
export function getAllPublicChallenges() {
  return CHALLENGES.map(({ flag, ...safe }) => safe);
}
