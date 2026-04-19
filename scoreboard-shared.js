export const STORAGE_KEY = "free-fire-scoreboard";
export const STORAGE_SYNC_KEY = "free-fire-scoreboard-sync";

export const defaultTeams = [
  { id: "team-1", seedOrder: 1, name: "A7", points: 4, status: [true, true, true, true], logo: "", eliminationOrder: null },
  { id: "team-2", seedOrder: 2, name: "FX", points: 4, status: [true, true, true, true], logo: "", eliminationOrder: null },
  { id: "team-3", seedOrder: 3, name: "INTZ", points: 4, status: [true, true, true, true], logo: "", eliminationOrder: null },
  { id: "team-4", seedOrder: 4, name: "LOS", points: 3, status: [true, false, false, false], logo: "", eliminationOrder: null },
  { id: "team-5", seedOrder: 5, name: "LOUD", points: 3, status: [true, true, true, true], logo: "", eliminationOrder: null },
  { id: "team-6", seedOrder: 6, name: "RISE", points: 3, status: [false, false, false, false], logo: "", eliminationOrder: 2 },
  { id: "team-7", seedOrder: 7, name: "VP", points: 3, status: [true, true, true, true], logo: "", eliminationOrder: null },
  { id: "team-8", seedOrder: 8, name: "AOP", points: 1, status: [true, false, false, false], logo: "", eliminationOrder: null },
  { id: "team-9", seedOrder: 9, name: "RUSH", points: 1, status: [true, true, true, true], logo: "", eliminationOrder: null },
  { id: "team-10", seedOrder: 10, name: "AXS", points: 0, status: [true, true, true, true], logo: "", eliminationOrder: null },
  { id: "team-11", seedOrder: 11, name: "E1", points: 0, status: [true, true, true, true], logo: "", eliminationOrder: null },
  { id: "team-12", seedOrder: 12, name: "LPS", points: 0, status: [false, false, false, false], logo: "", eliminationOrder: 1 }
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
      id: String(team.id ?? baseTeam.id),
      seedOrder: Number(team.seedOrder ?? baseTeam.seedOrder) || baseTeam.seedOrder,
      name: String(team.name ?? baseTeam.name).trim().toUpperCase() || baseTeam.name,
      points: Math.max(0, Number(team.points ?? baseTeam.points) || 0),
      logo: String(team.logo ?? baseTeam.logo ?? "").trim(),
      status: normalizeStatus(team.status ?? team.kills ?? baseTeam.status),
      eliminationOrder: team.eliminationOrder == null ? null : Math.max(1, Number(team.eliminationOrder) || 1)
    };
  });
}

export function getAliveCount(team) {
  return normalizeStatus(team.status).filter(Boolean).length;
}

export function isTeamEliminated(team) {
  return getAliveCount(team) === 0;
}

export function getNextEliminationOrder(teams) {
  return teams.reduce((maxOrder, team) => Math.max(maxOrder, Number(team.eliminationOrder) || 0), 0) + 1;
}

export function getRankedTeams(teams) {
  const sanitizedTeams = sanitizeTeams(teams);
  const activeTeams = sanitizedTeams
    .filter((team) => !isTeamEliminated(team))
    .sort((leftTeam, rightTeam) => (
      rightTeam.points - leftTeam.points ||
      getAliveCount(rightTeam) - getAliveCount(leftTeam) ||
      leftTeam.seedOrder - rightTeam.seedOrder
    ));

  const eliminatedTeams = sanitizedTeams
    .filter((team) => isTeamEliminated(team))
    .sort((leftTeam, rightTeam) => (
      (Number(rightTeam.eliminationOrder) || 0) - (Number(leftTeam.eliminationOrder) || 0) ||
      leftTeam.seedOrder - rightTeam.seedOrder
    ));

  return [...activeTeams, ...eliminatedTeams].map((team, index) => ({
    ...team,
    rank: index + 1,
    highlight: index === 0 ? "warning" : isTeamEliminated(team) ? "danger" : ""
  }));
}

export function getOrderedTeamsForStorage(teams) {
  return getRankedTeams(teams).map(({ rank, highlight, ...team }) => team);
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
