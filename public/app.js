(function () {
  const page = document.body.dataset.page;
  const state = {
    connect: null,
    updatedAt: null,
    playersSignature: null,
    playersFlashTimeoutId: null
  };

  const formatValue = (value, fallback = "—") => {
    if (value === null || value === undefined || value === "") {
      return fallback;
    }

    return String(value);
  };

  const prettifyTokenText = (value) => {
    return formatValue(value).replace(/_/g, " ");
  };

  const parseMapAndMode = (rawMap, fallbackMode) => {
    const source = typeof rawMap === "string" ? rawMap.trim() : "";
    const fallback = typeof fallbackMode === "string" ? fallbackMode.trim() : "";

    if (!source) {
      return {
        map: "—",
        mode: fallback ? prettifyTokenText(fallback) : "—"
      };
    }

    const separatorIndex = source.indexOf("_");

    if (separatorIndex === -1) {
      return {
        map: source,
        mode: fallback ? prettifyTokenText(fallback) : source
      };
    }

    const mapPart = source.slice(0, separatorIndex).trim();
    const modePart = source.slice(separatorIndex + 1).trim();

    if (!mapPart || !modePart) {
      return {
        map: source,
        mode: fallback ? prettifyTokenText(fallback) : source
      };
    }

    return {
      map: mapPart,
      mode: modePart.replace(/_/g, " ")
    };
  };

  const statusToLabel = (status, stale) => {
    const normalized = String(status || "").toLowerCase();

    if (stale) {
      return {
        text: "Кеш",
        state: "stale"
      };
    }

    if (normalized === "online") {
      return {
        text: "Онлайн",
        state: "online"
      };
    }

    if (normalized === "offline") {
      return {
        text: "Офлайн",
        state: "offline"
      };
    }

    return {
      text: formatValue(status, "Невідомо"),
      state: normalized || "unknown"
    };
  };

  const buildPlayersPresentation = (players, maxPlayers, queue) => {
    const base = `${formatValue(players, "—")}/${formatValue(maxPlayers, "—")}`;

    if (typeof queue === "number" && queue > 0) {
      return {
        text: `${base} (+${queue})`,
        markup: `<span class="server-card__players-main">${base}</span><span class="server-card__players-queue">(+${queue})</span>`,
        signature: `${base}|${queue}`
      };
    }

    return {
      text: base,
      markup: `<span class="server-card__players-main">${base}</span>`,
      signature: `${base}|0`
    };
  };

  const formatReservedQueue = (reservedQueue) => {
    if (typeof reservedQueue === "number" && reservedQueue > 0) {
      return `Резервна черга: +${reservedQueue}`;
    }

    return "";
  };

  const cleanServerName = (name) => {
    return formatValue(name, "UKRSWAGA Squad Server").replace(/\s*\|\s*discord\.gg\/\S+/i, "");
  };

  const formatTeamName = (value) => {
    if (!value) {
      return "";
    }

    return String(value)
      .replace(/_/g, " ")
      .replace(/\bLO\b/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s{2,}/g, " ")
      .trim();
  };

  const formatTeams = (teamOne, teamTwo) => {
    const left = formatTeamName(teamOne);
    const right = formatTeamName(teamTwo);

    if (!left && !right) {
      return "Сторони недоступні";
    }

    if (!left || !right) {
      return left || right;
    }

    return `${left} vs ${right}`;
  };

  const fetchJson = async (url) => {
    const response = await fetch(url, {
      headers: {
        accept: "application/json"
      },
      cache: "no-store"
    });

    const payload = await response.json();
    return { response, payload };
  };

  const updateFallbackIp = (ip) => {
    const fallbackInputs = document.querySelectorAll("#fallback-ip, #join-fallback-ip");
    fallbackInputs.forEach((input) => {
      input.value = ip || "84.200.135.63:7797";
    });
  };

  const showCopyConfirmation = (button, originalText) => {
    button.textContent = "Скопійовано";
    window.setTimeout(() => {
      button.textContent = originalText;
    }, 1200);
  };

  const wireCopyButton = (buttonId, inputId) => {
    const button = document.getElementById(buttonId);
    const input = document.getElementById(inputId);

    if (!button || !input) {
      return;
    }

    const originalText = button.textContent;

    button.addEventListener("click", async () => {
      input.select();
      input.setSelectionRange(0, input.value.length);

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(input.value);
        } else {
          document.execCommand("copy");
        }

        showCopyConfirmation(button, originalText);
      } catch {
        showCopyConfirmation(button, originalText);
      }
    });
  };

  const loadConnect = async () => {
    const { payload } = await fetchJson("/api/connect");
    state.connect = payload;
    updateFallbackIp(payload.fallbackIp);
    return payload;
  };

  const revealFallback = (message) => {
    const fallbackBox = document.getElementById("fallback-box");
    const joinFeedback = document.getElementById("join-feedback");

    if (fallbackBox) {
      fallbackBox.hidden = false;
    }

    if (joinFeedback && message) {
      joinFeedback.hidden = false;
      joinFeedback.textContent = message;
    }
  };

  const openConnectUrl = (connectUrl) => {
    window.location.href = connectUrl;
  };

  const formatUpdatedAge = (isoString) => {
    if (!isoString) {
      return "Оновлено —";
    }

    const timestamp = new Date(isoString).getTime();

    if (Number.isNaN(timestamp)) {
      return "Оновлено —";
    }

    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));

    if (seconds < 5) {
      return "Оновлено щойно";
    }

    if (seconds < 60) {
      return `Оновлено ${seconds} с тому`;
    }

    const minutes = Math.floor(seconds / 60);
    return `Оновлено ${minutes} хв тому`;
  };

  const refreshUpdatedLabel = () => {
    const updatedElement = document.getElementById("status-updated");

    if (!updatedElement) {
      return;
    }

    updatedElement.textContent = formatUpdatedAge(state.updatedAt);
  };

  const flashPlayers = (element) => {
    element.classList.remove("is-updating");
    void element.offsetWidth;
    element.classList.add("is-updating");

    if (state.playersFlashTimeoutId) {
      window.clearTimeout(state.playersFlashTimeoutId);
    }

    state.playersFlashTimeoutId = window.setTimeout(() => {
      element.classList.remove("is-updating");
      state.playersFlashTimeoutId = null;
    }, 420);
  };

  const renderStatus = (payload) => {
    const chip = document.getElementById("status-pill");
    const chipText = document.getElementById("status-pill-text");
    const detailTitle = document.getElementById("detail-title");
    const detailSubtitle = document.getElementById("detail-subtitle");
    const detailPlayersLine = document.getElementById("detail-players-line");
    const detailFactions = document.getElementById("detail-factions");
    const detailVersion = document.getElementById("detail-version");
    const detailReserved = document.getElementById("detail-reserved");

    if (!payload.ok) {
      if (chip) {
        chip.dataset.state = "offline";
      }

      if (chipText) {
        chipText.textContent = "Недоступно";
      }

      state.updatedAt = null;
      refreshUpdatedLabel();

      if (detailTitle) {
        detailTitle.textContent = "Сервер недоступний";
      }

      if (detailSubtitle) {
        detailSubtitle.textContent = "Спробуйте оновити сторінку трохи пізніше.";
      }

      if (detailPlayersLine) {
        detailPlayersLine.textContent = "—";
      }

      if (detailFactions) {
        detailFactions.textContent = "Сторони недоступні";
      }

      if (detailVersion) {
        detailVersion.hidden = true;
      }

      if (detailReserved) {
        detailReserved.hidden = true;
      }

      return;
    }

    const { server, stale } = payload;
    const label = statusToLabel(server.status, stale);
    const serverName = cleanServerName(server.name);
    const teams = formatTeams(server.teamOne, server.teamTwo);
    const players = buildPlayersPresentation(server.players, server.maxPlayers, server.queue);
    const reservedText = formatReservedQueue(server.reservedQueue);
    const versionText = server.version ? server.version : "";
    const mapMode = parseMapAndMode(server.map, server.gameMode);
    state.updatedAt = server.updatedAt || new Date().toISOString();
    refreshUpdatedLabel();

    if (chip) {
      chip.dataset.state = label.state;
    }

    if (chipText) {
      chipText.textContent = label.text;
    }

    if (detailTitle) {
      detailTitle.textContent = serverName;
    }

    if (detailSubtitle) {
      detailSubtitle.textContent = `${mapMode.map} • ${mapMode.mode}`;
    }

    if (detailPlayersLine) {
      detailPlayersLine.innerHTML = players.markup;

      if (state.playersSignature !== null && state.playersSignature !== players.signature) {
        flashPlayers(detailPlayersLine);
      }
    }

    if (detailFactions) {
      detailFactions.textContent = teams;
    }

    if (detailVersion) {
      detailVersion.hidden = !versionText;
      detailVersion.textContent = versionText;
    }

    if (detailReserved) {
      detailReserved.hidden = !reservedText;
      detailReserved.textContent = reservedText;
    }

    state.playersSignature = players.signature;
  };

  const loadStatus = async () => {
    try {
      const { payload } = await fetchJson("/api/status");
      renderStatus(payload);
    } catch (error) {
      renderStatus({
        ok: false,
        error: error instanceof Error ? error.message : "Status request failed."
      });
    }
  };

  const initHomePage = () => {
    const joinButton = document.getElementById("join-button");

    wireCopyButton("copy-ip-button", "fallback-ip");
    void loadConnect().catch(() => {
      revealFallback("Не вдалося перевірити поточне посилання для входу.");
    });
    void loadStatus();
    window.setInterval(() => {
      void loadStatus();
    }, 15000);
    window.setInterval(refreshUpdatedLabel, 1000);

    if (!joinButton) {
      return;
    }

    joinButton.addEventListener("click", async () => {
      joinButton.disabled = true;

      try {
        const connect = await loadConnect();

        if (connect.ok && connect.connectUrl) {
          openConnectUrl(connect.connectUrl);
          return;
        }

        revealFallback("Посилання для входу ще не задане. Скористайтеся резервним IP.");
      } catch {
        revealFallback("Не вдалося отримати посилання для входу. Скористайтеся резервним IP.");
      } finally {
        window.setTimeout(() => {
          joinButton.disabled = false;
        }, 600);
      }
    });
  };

  const initJoinPage = () => {
    const statusElement = document.getElementById("join-page-status");
    const openButton = document.getElementById("open-steam-button");

    wireCopyButton("join-copy-ip-button", "join-fallback-ip");

    const setJoinStatus = (text) => {
      if (statusElement) {
        statusElement.textContent = text;
      }
    };

    const triggerOpen = () => {
      if (state.connect?.ok && state.connect.connectUrl) {
        setJoinStatus("Якщо браузер попросить підтвердження, дозвольте відкрити Steam.");
        openConnectUrl(state.connect.connectUrl);
      } else {
        setJoinStatus("Поточне посилання для входу недоступне. Використайте резервний IP нижче.");
      }
    };

    if (openButton) {
      openButton.addEventListener("click", triggerOpen);
    }

    void loadConnect()
      .then((connect) => {
        if (connect.ok && connect.connectUrl) {
          setJoinStatus("Намагаємося відкрити Steam із поточним joinlobby-посиланням…");
          window.setTimeout(triggerOpen, 150);
        } else {
          if (openButton) {
            openButton.disabled = true;
          }

          setJoinStatus("Посилання для входу ще не встановлено. Додайте його через адмін API або локальний скрипт.");
        }
      })
      .catch(() => {
        if (openButton) {
          openButton.disabled = true;
        }

        setJoinStatus("Не вдалося завантажити поточне посилання. Спробуйте ще раз пізніше.");
      });
  };

  if (page === "home") {
    initHomePage();
  }

  if (page === "join") {
    initJoinPage();
  }
})();
