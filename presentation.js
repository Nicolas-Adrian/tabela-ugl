import { fetchRemoteScoreboard, isAppsScriptConfigured, subscribeRemoteScoreboard } from "./apps-script-service.js";
import { STORAGE_KEY, STORAGE_SYNC_KEY, cloneDefaultTeams, createFallback, getRankedTeams, loadStoredTeams, normalizeStatus, persistLocalTeams, sanitizeTeams } from "./scoreboard-shared.js";

const syncChannel = "BroadcastChannel" in window ? new BroadcastChannel("free-fire-scoreboard-channel") : null;

const html = document.documentElement;
const scoreboardBody = document.getElementById("scoreboard-body");

let teams = loadStoredTeams() ?? cloneDefaultTeams();
let lastSavedState = JSON.stringify(teams);
let hasAnimatedIn = false;

function renderRows() {
  scoreboardBody.innerHTML = getRankedTeams(teams).map((team, index) => {
    const bars = normalizeStatus(team.status).map((isAlive) => `
      <span class="status-bar ${isAlive ? "active" : ""}"></span>
    `).join("");

    const logo = team.logo
      ? `<img src="${team.logo}" alt="Logo ${team.name}">`
      : createFallback(team.name);

    return `
      <article class="table-row ${team.highlight}" style="--row-delay: ${index * 120}ms;">
        <div class="row-rank">${team.rank}</div>
        <div class="row-team">
          <div class="team-logo">${logo}</div>
          <div class="team-name">${team.name}</div>
        </div>
        <div class="row-points">${team.points}</div>
        <div class="row-status">
          <div class="status-bars" aria-label="${normalizeStatus(team.status).filter(Boolean).length} jogadores vivos">
            ${bars}
          </div>
        </div>
      </article>
    `;
  }).join("");

  if (!hasAnimatedIn) {
    html.classList.add("presentation-animate");
    window.setTimeout(() => {
      html.classList.remove("presentation-animate");
      hasAnimatedIn = true;
    }, 2200);
  }
}

function applyTeams(nextTeams) {
  teams = sanitizeTeams(nextTeams);
  lastSavedState = persistLocalTeams(teams);
  renderRows();
}

function syncTeamsFromStorage() {
  const storedTeams = loadStoredTeams();

  if (!storedTeams) {
    return;
  }

  const serializedState = JSON.stringify(storedTeams);

  if (serializedState === lastSavedState) {
    return;
  }

  teams = storedTeams;
  lastSavedState = serializedState;
  renderRows();
}

html.classList.add("presentation-active", "overlay-mode");
renderRows();

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY || event.key === STORAGE_SYNC_KEY) {
    syncTeamsFromStorage();
  }
});

window.addEventListener("message", (event) => {
  if (event.data?.type === "scoreboard-update" && Array.isArray(event.data.teams)) {
    applyTeams(event.data.teams);
  }
});

if (syncChannel) {
  syncChannel.addEventListener("message", () => {
    syncTeamsFromStorage();
  });
}

window.setInterval(syncTeamsFromStorage, 1000);

async function initRemoteSync() {
  if (!isAppsScriptConfigured()) {
    return;
  }

  try {
    const remoteTeams = await fetchRemoteScoreboard();

    if (remoteTeams) {
      applyTeams(remoteTeams);
    }

    subscribeRemoteScoreboard((nextTeams) => {
      if (!nextTeams) {
        return;
      }

      const serializedState = JSON.stringify(nextTeams);

      if (serializedState !== lastSavedState) {
        applyTeams(nextTeams);
      }
    });
  } catch {
    // Local fallback stays active if Apps Script is unavailable.
  }
}

initRemoteSync();
