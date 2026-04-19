import { fetchRemoteScoreboard, isAppsScriptConfigured, saveRemoteScoreboard, subscribeRemoteScoreboard, uploadLogoAsset } from "./apps-script-service.js";
import { STORAGE_KEY, STORAGE_SYNC_KEY, cloneDefaultTeams, createFallback, getNextEliminationOrder, getOrderedTeamsForStorage, getRankedTeams, isTeamEliminated, loadStoredTeams, normalizeStatus, persistLocalTeams, sanitizeTeams } from "./scoreboard-shared.js";

const syncChannel = "BroadcastChannel" in window ? new BroadcastChannel("free-fire-scoreboard-channel") : null;

const html = document.documentElement;
const scoreboardBody = document.getElementById("scoreboard-body");
const editorForm = document.getElementById("editor-form");
const teamSelect = document.getElementById("team-select");
const teamNameInput = document.getElementById("team-name");
const teamPointsInput = document.getElementById("team-points");
const teamLogoUrlInput = document.getElementById("team-logo-url");
const teamLogoFileInput = document.getElementById("team-logo-file");
const resetButton = document.getElementById("reset-button");
const presentationButton = document.getElementById("presentation-button");
const copyOutputLinkButton = document.getElementById("copy-output-link-button");
const outputLinkInput = document.getElementById("output-link");
const openOutputButton = document.getElementById("open-output-button");
const exitPresentationButton = document.getElementById("exit-presentation-button");
const floatingExitPresentationButton = document.getElementById("floating-exit-presentation-button");
const syncStatus = document.getElementById("sync-status");
const playerStatusInputs = [
  document.getElementById("player-status-1"),
  document.getElementById("player-status-2"),
  document.getElementById("player-status-3"),
  document.getElementById("player-status-4")
];

let teams = loadStoredTeams() ?? cloneDefaultTeams();
let selectedTeamId = teams[0].id;
let lastSavedState = JSON.stringify(teams);
let presentationWindow = null;
let suppressRemoteSave = false;

function setSyncStatus(mode, hasError = false) {
  if (!syncStatus) {
    return;
  }

  syncStatus.textContent = mode;
  syncStatus.classList.toggle("online", !hasError && (mode.toLowerCase().includes("apps script") || mode.toLowerCase().includes("online")));
  syncStatus.classList.toggle("error", hasError);
}

function buildOutputLink() {
  return new URL("presentation.html", window.location.href).toString();
}

function refreshOutputLink() {
  outputLinkInput.value = buildOutputLink();
}

function commitLocalState(nextTeams) {
  teams = getOrderedTeamsForStorage(nextTeams);
  lastSavedState = persistLocalTeams(teams);

  if (syncChannel) {
    syncChannel.postMessage({ type: "teams-updated" });
  }

  syncPresentationWindow();
}

async function saveTeams() {
  commitLocalState(teams);

  if (!isAppsScriptConfigured() || suppressRemoteSave) {
    return;
  }

  try {
    await saveRemoteScoreboard(teams);
    setSyncStatus("Sincronização: Apps Script online");
  } catch {
    setSyncStatus("Sincronização: erro ao salvar no Apps Script", true);
  }
}

async function resolveLogoValue(teamName, logoValue) {
  const trimmedLogo = String(logoValue ?? "").trim();

  if (!trimmedLogo || !isAppsScriptConfigured()) {
    return trimmedLogo;
  }

  if (trimmedLogo.startsWith("data:")) {
    setSyncStatus("Sincronização: enviando logo para o Apps Script...");

    const extensionMatch = trimmedLogo.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/);
    const extension = extensionMatch ? extensionMatch[1].replace("jpeg", "jpg") : "png";
    const logoUrl = await uploadLogoAsset(trimmedLogo, `${teamName.toLowerCase()}-logo.${extension}`);

    setSyncStatus("Sincronização: logo enviada, salvando tabela...");
    return logoUrl;
  }

  if (/^https?:\/\//i.test(trimmedLogo)) {
    setSyncStatus("Sincronização: baixando logo pela URL...");

    try {
      const response = await fetch(trimmedLogo, { mode: "cors" });

      if (!response.ok) {
        throw new Error("Image fetch failed");
      }

      const blob = await response.blob();

      if (!blob.type.startsWith("image/")) {
        throw new Error("URL is not an image");
      }

      const dataUrl = await blobToDataUrl(blob);
      const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "png";

      setSyncStatus("Sincronização: enviando logo da URL para o Apps Script...");
      const logoUrl = await uploadLogoAsset(dataUrl, `${teamName.toLowerCase()}-logo.${extension}`);

      setSyncStatus("Sincronização: logo enviada, salvando tabela...");
      return logoUrl;
    } catch {
      setSyncStatus("Sincronização: URL salva sem upload; confira se a imagem é pública", true);
      return trimmedLogo;
    }
  }

  return trimmedLogo;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function renderRows() {
  const rankedTeams = getRankedTeams(teams);

  scoreboardBody.innerHTML = rankedTeams.map((team, index) => {
    const bars = normalizeStatus(team.status).map((isAlive) => {
      const active = isAlive ? "active" : "";
      return `<span class="status-bar ${active}"></span>`;
    }).join("");

    const logo = team.logo
      ? `<img src="${team.logo}" alt="Logo ${team.name}">`
      : createFallback(team.name);

    const selected = team.id === selectedTeamId ? "selected" : "";

    return `
      <article class="table-row ${team.highlight} ${selected}" data-team-id="${team.id}" style="--row-delay: ${index * 120}ms;">
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
}

function renderSelectOptions() {
  teamSelect.innerHTML = getRankedTeams(teams).map((team) => `
    <option value="${team.id}">${team.rank}. ${team.name}</option>
  `).join("");
}

function fillForm(teamId) {
  const team = teams.find((item) => item.id === String(teamId));

  if (!team) {
    return;
  }

  selectedTeamId = team.id;
  teamSelect.value = team.id;
  teamNameInput.value = team.name;
  teamPointsInput.value = team.points;
  teamLogoUrlInput.value = team.logo || "";
  teamLogoFileInput.value = "";
  normalizeStatus(team.status).forEach((value, index) => {
    playerStatusInputs[index].checked = value;
  });
  renderRows();
}

async function applyTeams(nextTeams, source = "local") {
  teams = getOrderedTeamsForStorage(nextTeams);
  commitLocalState(teams);
  renderSelectOptions();
  fillForm(selectedTeamId);

  if (source === "remote") {
    suppressRemoteSave = true;
    window.setTimeout(() => {
      suppressRemoteSave = false;
    }, 0);
  }
}

function syncPresentationWindow() {
  if (!presentationWindow || presentationWindow.closed) {
    return;
  }

  try {
    presentationWindow.postMessage({ type: "scoreboard-update", teams }, "*");
  } catch {
    // Presentation page still syncs through Firebase/local fallback.
  }
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
  refreshOutputLink();
  renderSelectOptions();
  fillForm(selectedTeamId);
}

function replayPresentationAnimation() {
  scoreboardBody.querySelectorAll(".table-row").forEach((row) => {
    row.style.animation = "none";
    void row.offsetWidth;
    row.style.animation = "";
  });
}

async function enterPresentationMode() {
  html.classList.add("presentation-active");

  if (document.fullscreenElement !== document.documentElement) {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen is optional.
    }
  }

  renderRows();
  replayPresentationAnimation();
}

async function exitPresentationMode() {
  html.classList.remove("presentation-active");
  renderRows();

  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      // Keeps the page usable even if exit fails.
    }
  }
}

teamSelect.addEventListener("change", (event) => {
  fillForm(event.target.value);
});

scoreboardBody.addEventListener("click", (event) => {
  const row = event.target.closest(".table-row");

  if (row) {
    fillForm(row.dataset.teamId);
  }
});

teamLogoFileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;

  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    teamLogoUrlInput.value = reader.result;
  };
  reader.readAsDataURL(file);
});

editorForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const nextTeamName = teamNameInput.value.trim().toUpperCase() || "TIME";
  let nextLogoValue = teamLogoUrlInput.value.trim();

  try {
    nextLogoValue = await resolveLogoValue(nextTeamName, nextLogoValue);
  } catch {
    setSyncStatus("Sincronização: erro ao enviar a logo", true);
    return;
  }

  teams = teams.map((team) => (
    team.id === selectedTeamId
      ? updateTeamWithRankingRules(team, {
          name: nextTeamName,
          points: Math.max(0, Number(teamPointsInput.value) || 0),
          status: playerStatusInputs.map((input) => input.checked),
          logo: nextLogoValue
        })
      : team
  ));

  await saveTeams();
  renderSelectOptions();
  fillForm(selectedTeamId);
});

resetButton.addEventListener("click", async () => {
  teams = cloneDefaultTeams();
  await saveTeams();
  renderSelectOptions();
  fillForm(teams[0].id);
});

presentationButton.addEventListener("click", () => {
  enterPresentationMode();
});

exitPresentationButton.addEventListener("click", () => {
  exitPresentationMode();
});

floatingExitPresentationButton.addEventListener("click", () => {
  exitPresentationMode();
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    html.classList.remove("presentation-active");
    renderRows();
  }
});

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY || event.key === STORAGE_SYNC_KEY) {
    syncTeamsFromStorage();
  }
});

if (syncChannel) {
  syncChannel.addEventListener("message", () => {
    syncTeamsFromStorage();
  });
}

copyOutputLinkButton.addEventListener("click", async () => {
  const outputLink = buildOutputLink();
  outputLinkInput.value = outputLink;

  try {
    await navigator.clipboard.writeText(outputLink);
    copyOutputLinkButton.textContent = "Link copiado";
  } catch {
    outputLinkInput.focus();
    outputLinkInput.select();
    copyOutputLinkButton.textContent = "Copie manualmente";
  }

  window.setTimeout(() => {
    copyOutputLinkButton.textContent = "Copiar link OBS";
  }, 1800);
});

openOutputButton.addEventListener("click", () => {
  presentationWindow = window.open(buildOutputLink(), "free-fire-presentation");
  window.setTimeout(() => {
    syncPresentationWindow();
  }, 300);
});

async function initRemoteSync() {
  if (!isAppsScriptConfigured()) {
    setSyncStatus("Sincronização: local (preencha apps-script-config.js para publicar)");
    return;
  }

  setSyncStatus("Sincronização: conectando ao Apps Script...");

  try {
    const remoteTeams = await fetchRemoteScoreboard();

    if (remoteTeams) {
      teams = remoteTeams;
      commitLocalState(teams);
      renderSelectOptions();
      fillForm(selectedTeamId);
    } else {
      await saveRemoteScoreboard(teams);
    }

    subscribeRemoteScoreboard(
      (nextTeams) => {
        if (!nextTeams) {
          return;
        }

        const serializedState = JSON.stringify(nextTeams);

        if (serializedState === lastSavedState) {
          return;
        }

        teams = nextTeams;
        commitLocalState(teams);
        renderSelectOptions();
        fillForm(selectedTeamId);
        setSyncStatus("Sincronização: Apps Script online");
      },
      () => {
        setSyncStatus("Sincronização: erro na leitura do Apps Script", true);
      }
    );

    setSyncStatus("Sincronização: Apps Script online");
  } catch {
    setSyncStatus("Sincronização: erro ao conectar no Apps Script", true);
  }
}

refreshOutputLink();
renderSelectOptions();
renderRows();
fillForm(selectedTeamId);
initRemoteSync();

function updateTeamWithRankingRules(currentTeam, nextValues) {
  const nextStatus = normalizeStatus(nextValues.status ?? currentTeam.status);
  const wasEliminated = isTeamEliminated(currentTeam);
  const isEliminated = nextStatus.every((statusValue) => !statusValue);

  let eliminationOrder = currentTeam.eliminationOrder;

  if (!wasEliminated && isEliminated) {
    eliminationOrder = getNextEliminationOrder(teams);
  }

  if (wasEliminated && !isEliminated) {
    eliminationOrder = null;
  }

  return {
    ...currentTeam,
    ...nextValues,
    status: nextStatus,
    eliminationOrder
  };
}
