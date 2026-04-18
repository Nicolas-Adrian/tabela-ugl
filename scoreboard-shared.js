export const STORAGE_KEY = "free-fire-scoreboard";
export const STORAGE_SYNC_KEY = "free-fire-scoreboard-sync";

export const defaultTeams = [
  { rank: 1, name: "A7", points: 4, status: [true, true, true, true], logo: "", highlight: "" },
  { rank: 2, name: "FX", points: 4, status: [true, true, true, true], logo: "", highlight: "" },
  { rank: 3, name: "INTZ", points: 4, status: [true, true, true, true], logo: "", highlight: "" },
  { rank: 4, name: "LOS", points: 3, status: [true, false, false, false], logo: "", highlight: "" },
  { rank: 5, name: "LOUD", points: 3, status: [true, true, true, true], logo: "", highlight: "" },
  { rank: 6, name: "RISE", points: 3, status: [false, false, false, false], logo: "", highlight: "danger" },
  { rank: 7, name: "VP", points: 3, status: [true, true, true, true], logo: "", highlight: "" },
  { rank: 8, name: "AOP", points: 1, status: [true, false, false, false], logo: "", highlight: "" },
  { rank: 9, name: "RUSH", points: 1, status: [true, true, true, true], logo: "", highlight: "warning" },
  { rank: 10, name: "AXS", points: 0, status: [true, true, true, true], logo: "", highlight: "" },
  { rank: 11, name: "E1", points: 0, status: [true, true, true, true], logo: "", highlight: "" },
  { rank: 12, name: "LPS", points: 0, status: [false, false, false, false], logo: "", highlight: "danger" }
];

export function cloneDefaultTeams() {
  return structuredClone(defaultTeams);
}

export function normalizeStatus(statusValue) {
  if (Array.isArray(statusValue)) {
    return statusValue.slice(0, 4).map(Boolean).concat(Array(Math.max(0, 4 - statusValue.length)).fill(false));
  }

  const alivePlayers = Math.min(4, Math.max(0, Number(statusValue) || 0));
  return Array.from({ length: 4 }, (_, index) => index < alivePlayers);
}

export function sanitizeTeams(rawTeams) {
  if (!Array.isArray(rawTeams)) {
    return cloneDefaultTeams();
  }

  return defaultTeams.map((baseTeam, index) => {
    const team = rawTeams[index] ?? {};
    return {
      ...baseTeam,
      ...team,
      name: String(team.name ?? baseTeam.name).trim().toUpperCase() || baseTeam.name,
      points: Math.max(0, Number(team.points ?? baseTeam.points) || 0),
      logo: String(team.logo ?? baseTeam.logo ?? "").trim(),
      status: normalizeStatus(team.status ?? team.kills ?? baseTeam.status)
    };
  });
}

export function createFallback(name) {
  return `<div class="team-fallback">${String(name).slice(0, 3).toUpperCase()}</div>`;
}

export function loadStoredTeams() {
  const savedTeams = localStorage.getItem(STORAGE_KEY);

  if (!savedTeams) {
    return null;
  }

  try {
    return sanitizeTeams(JSON.parse(savedTeams));
  } catch {
    return null;
  }
}

export function persistLocalTeams(teams) {
  const serialized = JSON.stringify(sanitizeTeams(teams));
  localStorage.setItem(STORAGE_KEY, serialized);
  localStorage.setItem(STORAGE_SYNC_KEY, String(Date.now()));
  return serialized;
}
