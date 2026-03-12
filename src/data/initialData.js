export const CATEGORIES = {
  pwn:      { color: "#ff4444", glow: "rgba(255,68,68,0.35)" },
  crypto:   { color: "#00d4ff", glow: "rgba(0,212,255,0.35)" },
  forensics:{ color: "#a855f7", glow: "rgba(168,85,247,0.35)" },
  web:      { color: "#22c55e", glow: "rgba(34,197,94,0.35)" },
  misc:     { color: "#f59e0b", glow: "rgba(245,158,11,0.35)" },
  rev:      { color: "#f97316", glow: "rgba(249,115,22,0.35)" },
};

export const DIFFICULTIES = {
  easy:   "#22c55e",
  medium: "#f59e0b",
  hard:   "#ff4444",
  insane: "#a855f7",
};

export const INITIAL_CHALLENGES = [
  {
    id: 1, name: "Buffer Overflow 101", category: "pwn", points: 100,
    solves: 47, totalTeams: 120, difficulty: "easy",
    flag: "CTF{stack_sm4shed}",
    description: "A classic stack-based buffer overflow. Overwrite the return address and redirect execution to win().",
    hints: [
      "Think carefully about stack layout and what lies beyond your buffer.",
      "The win() function is already compiled in — you just need to reach it.",
      "Use python -c to craft your payload. How many bytes until you hit the return address?",
    ],
  },
  {
    id: 2, name: "RSA? More like RSB", category: "crypto", points: 250,
    solves: 23, totalTeams: 120, difficulty: "medium",
    flag: "CTF{sm4ll_e_big_pr0blems}",
    description: "An RSA implementation with a suspiciously small public exponent. No padding was used in the making of this challenge.",
    hints: [
      "What happens when the message is small and e is very small?",
      "If m^e < n, you don't even need to reduce mod n.",
      "Integer cube root. That's your whole attack.",
    ],
  },
  {
    id: 3, name: "Needle in a Haystack", category: "forensics", points: 150,
    solves: 61, totalTeams: 120, difficulty: "easy",
    flag: "CTF{stegh1de_and_seek}",
    description: "Something is hidden in this image. It's not just metadata.",
    hints: [
      "The flag isn't in the EXIF data. Look deeper.",
      "Steganography tools exist for a reason. Try stegsolve or zsteg.",
      "Check the least significant bits of the colour channels.",
    ],
  },
  {
    id: 4, name: "JWT Jailbreak", category: "web", points: 300,
    solves: 12, totalTeams: 120, difficulty: "hard",
    flag: "CTF{alg0rithm_c0nfusion}",
    description: "The admin panel is locked behind a JWT. You have a valid user token. Get admin.",
    hints: [
      "What algorithms does the server accept? It might be more than one.",
      "The alg header is user-controlled. What if you set it to none?",
      "If RS256 verification falls back to HS256, what key might the server use to verify?",
    ],
  },
  {
    id: 5, name: "Kernel Panic", category: "pwn", points: 500,
    solves: 3, totalTeams: 120, difficulty: "insane",
    flag: "CTF{r1ng0_0_escape}",
    description: "Escape the kernel module. Ring 0 awaits. Good luck.",
    hints: [
      "Look for a race condition in the ioctl handler.",
      "Consider /proc/self/mem and what you can write to it.",
      "SMEP/SMAP are enabled. Think ret2usr alternatives.",
    ],
  },
  {
    id: 6, name: "Substitution Cipher", category: "crypto", points: 75,
    solves: 89, totalTeams: 120, difficulty: "easy",
    flag: "CTF{fr3qu3ncy_4nalysis}",
    description: "A simple substitution cipher. The message is long enough to crack by frequency.",
    hints: [
      "E is the most common letter in English. What's the most common character here?",
    ],
  },
  {
    id: 7, name: "XSS Safari", category: "web", points: 200,
    solves: 31, totalTeams: 120, difficulty: "medium",
    flag: "CTF{sc1pt_k1dd13_n0_m0re}",
    description: "Find a stored XSS vulnerability and steal the admin's cookie.",
    hints: [
      "The input is filtered, but is it filtered everywhere?",
      "Try different HTML contexts — attributes, event handlers, SVG.",
      "The admin bot visits your submitted URL every 30 seconds.",
    ],
  },
  {
    id: 8, name: "Reverse Me", category: "rev", points: 175,
    solves: 28, totalTeams: 120, difficulty: "medium",
    flag: "CTF{ghidra_g0d}",
    description: "A compiled binary checks your input and tells you if you're right. Find the right input.",
    hints: [
      "Load it in Ghidra or IDA. Find the string comparison.",
      "The check is done byte by byte — it's not hashed.",
      "ltrace will show you library calls including strcmp.",
    ],
  },
];

export const INITIAL_TEAMS = [
  { id: 1, rank: 1, name: "0xDEADBEEF",      score: 1425, solves: 8, lastSolve: "2m ago",  country: "🇬🇧" },
  { id: 2, rank: 2, name: "NullPointers",     score: 1250, solves: 7, lastSolve: "14m ago", country: "🇩🇪" },
  { id: 3, rank: 3, name: "SegFault Society", score: 1100, solves: 6, lastSolve: "31m ago", country: "🇺🇸" },
  { id: 4, rank: 4, name: "RootKit Rangers",  score: 875,  solves: 5, lastSolve: "1h ago",  country: "🇫🇷" },
  { id: 5, rank: 5, name: "kernel_panic()",   score: 750,  solves: 5, lastSolve: "1h ago",  country: "🇯🇵" },
  { id: 6, rank: 6, name: "ExploitExplorers", score: 625,  solves: 4, lastSolve: "2h ago",  country: "🇧🇷" },
  { id: 7, rank: 7, name: "HeapHunters",      score: 475,  solves: 3, lastSolve: "2h ago",  country: "🇨🇦" },
  { id: 8, rank: 8, name: "WilliamN06",       score: 325,  solves: 2, lastSolve: "3h ago",  country: "🇬🇧", isYou: true },
  { id: 9, rank: 9, name: "ByteBenders",      score: 225,  solves: 2, lastSolve: "4h ago",  country: "🇮🇳" },
  { id:10, rank:10, name: "ShellShockers",    score: 100,  solves: 1, lastSolve: "5h ago",  country: "🇦🇺" },
];
