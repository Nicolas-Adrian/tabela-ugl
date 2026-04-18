import { appsScriptConfig } from "./apps-script-config.js";
import { sanitizeTeams } from "./scoreboard-shared.js";

function normalizeBaseUrl() {
  const rawUrl = String(appsScriptConfig.webAppUrl ?? "").trim();
  return rawUrl.replace(/\/+$/, "");
}

export function isAppsScriptConfigured() {
  const baseUrl = normalizeBaseUrl();
  return baseUrl.startsWith("https://script.google.com/");
}

function buildUrl(params = {}) {
  const url = new URL(normalizeBaseUrl());

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

export async function fetchRemoteScoreboard() {
  if (!isAppsScriptConfigured()) {
    return null;
  }

  const response = await fetch(buildUrl({ mode: "read", t: String(Date.now()) }), {
    method: "GET",
    redirect: "follow",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Apps Script GET failed: ${response.status}`);
  }

  const payload = await response.json();

  if (!payload?.ok || !Array.isArray(payload.teams)) {
    return null;
  }

  return sanitizeTeams(payload.teams);
}

export async function saveRemoteScoreboard(teams) {
  if (!isAppsScriptConfigured()) {
    return false;
  }

  const response = await fetch(buildUrl({ mode: "write" }), {
    method: "POST",
    redirect: "follow",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({ teams: sanitizeTeams(teams) })
  });

  if (!response.ok) {
    throw new Error(`Apps Script POST failed: ${response.status}`);
  }

  const payload = await response.json();
  return Boolean(payload?.ok);
}

export async function uploadLogoAsset(dataUrl, fileName = "logo.png") {
  if (!isAppsScriptConfigured()) {
    return null;
  }

  const response = await fetch(buildUrl({ mode: "uploadLogo" }), {
    method: "POST",
    redirect: "follow",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      fileName,
      dataUrl
    })
  });

  if (!response.ok) {
    throw new Error(`Apps Script upload failed: ${response.status}`);
  }

  const payload = await response.json();

  if (!payload?.ok || !payload.logoUrl) {
    throw new Error("Apps Script upload failed: invalid payload");
  }

  return String(payload.logoUrl);
}

export function subscribeRemoteScoreboard(onTeams, onError, intervalMs = 1500) {
  if (!isAppsScriptConfigured()) {
    return () => {};
  }

  let cancelled = false;

  const poll = async () => {
    try {
      const teams = await fetchRemoteScoreboard();

      if (!cancelled && teams) {
        onTeams(teams);
      }
    } catch (error) {
      if (!cancelled && onError) {
        onError(error);
      }
    } finally {
      if (!cancelled) {
        window.setTimeout(poll, intervalMs);
      }
    }
  };

  poll();

  return () => {
    cancelled = true;
  };
}
