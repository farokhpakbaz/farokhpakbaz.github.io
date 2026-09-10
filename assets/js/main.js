(() => {
  const root = document.documentElement;
  const toggle = document.querySelector(".theme-toggle");
  const themeLabel = document.querySelector("[data-theme-label]");
  const themeIcon = toggle?.querySelector(".theme-icon");
  const siteHeader = document.querySelector("[data-site-header]");
  const siteNavigation = document.querySelector("[data-site-navigation]");
  const menuToggle = document.querySelector("[data-menu-toggle]");
  const storedTheme = localStorage.getItem("theme");
  const preferredTheme = window.matchMedia("(prefers-color-scheme: light)")
    .matches
    ? "light"
    : "dark";

  const setTheme = (theme) => {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    const nextTheme = theme === "dark" ? "light" : "dark";
    toggle?.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
    toggle?.setAttribute("title", `Switch to ${nextTheme} theme`);
    if (themeLabel) themeLabel.textContent = nextTheme;
    if (themeIcon) themeIcon.textContent = theme === "dark" ? "☼" : "☾";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#080b09" : "#eceee8");
  };

  const setSiteNavigation = (open, restoreFocus = false) => {
    if (!siteNavigation || !menuToggle) return;
    siteNavigation.classList.toggle("is-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    const menuLabel = menuToggle.querySelector(".sr-only");
    if (menuLabel)
      menuLabel.textContent = open ? "Close navigation" : "Open navigation";
    if (open) siteNavigation.querySelector("a")?.focus({ preventScroll: true });
    else if (restoreFocus) menuToggle.focus({ preventScroll: true });
  };

  const matrixToggle = document.querySelector("[data-matrix-toggle]");
  const matrixLauncher = document.querySelector("[data-matrix-launcher]");
  const matrixModeMenu = document.querySelector("[data-matrix-mode-menu]");
  const matrixLayer = document.querySelector("[data-matrix-layer]");
  const matrixFrame = document.querySelector("[data-matrix-frame]");
  const matrixUI = document.querySelector("[data-matrix-ui]");
  const matrixStatus = document.querySelector("[data-matrix-status]");
  const matrixSettingsPanel = document.querySelector("[data-matrix-settings]");
  const matrixInstallButtons = [
    ...document.querySelectorAll("[data-matrix-install]"),
  ];
  const matrixIntro = document.querySelector("[data-matrix-intro]");
  const matrixIntroQuote = document.querySelector("[data-matrix-intro-quote]");
  const matrixIntroAuthor = document.querySelector(
    "[data-matrix-intro-author]",
  );
  const matrixIntroSource = document.querySelector(
    "[data-matrix-intro-source]",
  );
  const matrixIntroCounter = document.querySelector(
    "[data-matrix-intro-counter]",
  );
  const matrixAudioCanvas = document.querySelector(
    "[data-matrix-audio-spectrum]",
  );
  const matrixAudioOptions = document.querySelector(
    "[data-matrix-audio-options]",
  );
  const matrixCustomQuoteInput = document.querySelector(
    "[data-matrix-custom-quote]",
  );
  const matrixCustomAuthorInput = document.querySelector(
    "[data-matrix-custom-author]",
  );
  const matrixCustomQuoteList = document.querySelector(
    "[data-matrix-custom-list]",
  );
  const matrixSettingsToggles = [
    ...document.querySelectorAll("[data-matrix-settings-toggle]"),
  ];
  const matrixSettingsToggle = matrixSettingsToggles[0];
  const matrixFullscreen = document.querySelector("[data-matrix-fullscreen]");
  const siteShell = document.querySelector(".site-shell");
  const focusPlayerPanel = document.querySelector("[data-player]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const matrixStorageKey = "matrix-settings-v1";
  const matrixCustomQuotesKey = "matrix-custom-quotes-v1";
  const matrixIntroSeenKey = "matrix-intro-seen-v1";
  let matrixMode = "off";
  let matrixLastMode = "ambient";
  let matrixIdleTimer;
  let matrixReloadTimer;
  let matrixResizeTimer;
  let matrixKeyboardNavigation = false;
  let matrixLastFocus;
  let matrixInstallPrompt;
  let matrixIntroTimer;
  let matrixIntroHideTimer;
  let matrixAudioStream;
  let matrixAudioContext;
  let matrixAudioAnalyser;
  let matrixAudioData;
  let matrixAudioFrame;

  const matrixAppDisplay = ["fullscreen", "standalone", "minimal-ui"].some(
    (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
  );

  const syncMatrixInstallButtons = () => {
    matrixInstallButtons.forEach((button) => {
      button.hidden = matrixAppDisplay || !matrixInstallPrompt;
    });
  };

  const matrixQuotes = [
    {
      id: "macbeth-shadow",
      text: "Life's but a walking shadow, a poor player,\nThat struts and frets his hour upon the stage,\nAnd then is heard no more. It is a tale\nTold by an idiot, full of sound and fury,\nSignifying nothing.",
      author: "William Shakespeare, Macbeth",
      sourceLabel: "Macbeth",
    },
    {
      id: "path",
      text: "There's a difference between knowing the path and walking the path.",
      author: "Morpheus — The Matrix",
      sourceLabel: "Goodreads",
      sourceURL:
        "https://www.goodreads.com/work/quotes/413869-the-matrix-the-shooting-script",
    },
    {
      id: "desert",
      text: "Welcome to the desert of the real.",
      author: "Morpheus — The Matrix",
      sourceLabel: "Goodreads",
      sourceURL:
        "https://www.goodreads.com/work/quotes/413869-the-matrix-the-shooting-script",
    },
    {
      id: "bliss",
      text: "Ignorance is bliss.",
      author: "Cypher — The Matrix",
      sourceLabel: "IMDb",
      sourceURL: "https://www.imdb.com/title/tt0133093/quotes/",
    },
    {
      id: "eyes",
      text: "Why do my eyes hurt?\nYou've never used them before.",
      author: "Neo / Morpheus — The Matrix",
      sourceLabel: "IMDb",
      sourceURL: "https://www.imdb.com/title/tt0133093/quotes/",
    },
  ];

  let matrixCustomQuotes = (() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(matrixCustomQuotesKey) || "[]",
      );
      return Array.isArray(saved)
        ? saved
            .filter(
              (quote) =>
                typeof quote?.text === "string" && quote.text.trim().length,
            )
            .slice(0, 30)
        : [];
    } catch {
      return [];
    }
  })();

  const matrixPresets = {
    trilogy: {
      color: "#63ff8a",
      speed: 0.3,
      charSize: 13,
      cycleSpeed: 0.012,
      trail: 0.8,
      slant: 0,
      glow: 0.5,
      brightness: -0.5,
      contrast: 1.1,
      spacing: 1,
      quality: "balanced",
    },
    operator: {
      color: "#50fa7b",
      speed: 0.48,
      charSize: 10,
      cycleSpeed: 0.008,
      trail: 1.3,
      slant: 0,
      glow: 0.7,
      brightness: -0.42,
      contrast: 1.25,
      spacing: 1,
      quality: "balanced",
    },
    calm: {
      color: "#8ef5a8",
      speed: 0.12,
      charSize: 18,
      cycleSpeed: 0.006,
      trail: 1.6,
      slant: 0,
      glow: 0.35,
      brightness: -0.62,
      contrast: 1,
      spacing: 1.15,
      quality: "eco",
    },
    dense: {
      color: "#39ff65",
      speed: 0.7,
      charSize: 8,
      cycleSpeed: 0.026,
      trail: 0.9,
      slant: -2,
      glow: 0.8,
      brightness: -0.45,
      contrast: 1.35,
      spacing: 0.9,
      quality: "high",
    },
    blue: {
      color: "#55c7ff",
      speed: 0.35,
      charSize: 12,
      cycleSpeed: 0.014,
      trail: 1.1,
      slant: 0,
      glow: 0.6,
      brightness: -0.5,
      contrast: 1.15,
      spacing: 1,
      quality: "balanced",
    },
    amber: {
      color: "#ffb347",
      speed: 0.28,
      charSize: 14,
      cycleSpeed: 0.01,
      trail: 1.3,
      slant: 1,
      glow: 0.55,
      brightness: -0.55,
      contrast: 1.2,
      spacing: 1.05,
      quality: "balanced",
    },
  };

  const matrixQuality = {
    eco: { fps: 24, resolution: 0.45 },
    balanced: { fps: 30, resolution: 0.65 },
    high: { fps: 60, resolution: 0.85 },
  };

  const matrixDefaults = {
    preset: "trilogy",
    ...matrixPresets.trilogy,
    beacon: false,
    beaconColor: "#c8ffd4",
    beaconIntensity: 1.8,
    ambientOpacity: 0.22,
    vignette: 0.58,
    scanlines: true,
    animate: !reducedMotion.matches,
    autoHide: true,
    quotesEnabled: true,
    randomQuotes: true,
    introDuration: 9,
    audioReactive: false,
    audioSensitivity: 1.2,
  };

  const clamp = (value, min, max, fallback = min) => {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.min(max, Math.max(min, number))
      : fallback;
  };

  const normalizeMatrixSettings = (settings = {}) => ({
    preset: [...Object.keys(matrixPresets), "custom"].includes(
      settings.preset === "classic" ? "trilogy" : settings.preset,
    )
      ? settings.preset === "classic"
        ? "trilogy"
        : settings.preset
      : matrixDefaults.preset,
    color: /^#[0-9a-f]{6}$/i.test(settings.color || "")
      ? settings.color.toLowerCase()
      : matrixDefaults.color,
    speed: clamp(settings.speed, 0.03, 1.2, matrixDefaults.speed),
    charSize: Math.round(
      clamp(settings.charSize, 7, 28, matrixDefaults.charSize),
    ),
    cycleSpeed: clamp(
      settings.cycleSpeed,
      0.002,
      0.08,
      matrixDefaults.cycleSpeed,
    ),
    trail: clamp(settings.trail, 0.2, 2, matrixDefaults.trail),
    slant: Math.round(clamp(settings.slant, -18, 18, matrixDefaults.slant)),
    glow: clamp(settings.glow, 0, 1, matrixDefaults.glow),
    brightness: clamp(
      settings.brightness,
      -1.2,
      0.2,
      matrixDefaults.brightness,
    ),
    contrast: clamp(settings.contrast, 0.7, 2, matrixDefaults.contrast),
    spacing: clamp(settings.spacing, 0.7, 1.5, matrixDefaults.spacing),
    quality: matrixQuality[settings.quality]
      ? settings.quality
      : matrixDefaults.quality,
    beacon:
      typeof settings.beacon === "boolean"
        ? settings.beacon
        : matrixDefaults.beacon,
    beaconColor: /^#[0-9a-f]{6}$/i.test(settings.beaconColor || "")
      ? settings.beaconColor.toLowerCase()
      : matrixDefaults.beaconColor,
    beaconIntensity: clamp(
      settings.beaconIntensity,
      0.5,
      4,
      matrixDefaults.beaconIntensity,
    ),
    ambientOpacity: clamp(
      settings.ambientOpacity,
      0.08,
      0.42,
      matrixDefaults.ambientOpacity,
    ),
    vignette: clamp(settings.vignette, 0, 1, matrixDefaults.vignette),
    scanlines:
      typeof settings.scanlines === "boolean"
        ? settings.scanlines
        : matrixDefaults.scanlines,
    animate:
      typeof settings.animate === "boolean"
        ? settings.animate
        : matrixDefaults.animate,
    autoHide:
      typeof settings.autoHide === "boolean"
        ? settings.autoHide
        : matrixDefaults.autoHide,
    quotesEnabled:
      typeof settings.quotesEnabled === "boolean"
        ? settings.quotesEnabled
        : matrixDefaults.quotesEnabled,
    randomQuotes:
      typeof settings.randomQuotes === "boolean"
        ? settings.randomQuotes
        : matrixDefaults.randomQuotes,
    introDuration: Math.round(
      clamp(settings.introDuration, 5, 15, matrixDefaults.introDuration),
    ),
    audioReactive:
      typeof settings.audioReactive === "boolean"
        ? settings.audioReactive
        : matrixDefaults.audioReactive,
    audioSensitivity: clamp(
      settings.audioSensitivity,
      0.5,
      3,
      matrixDefaults.audioSensitivity,
    ),
  });

  let matrixSettings = (() => {
    try {
      return normalizeMatrixSettings(
        JSON.parse(localStorage.getItem(matrixStorageKey) || "{}"),
      );
    } catch {
      return { ...matrixDefaults };
    }
  })();

  const matrixControl = (name) =>
    matrixSettingsPanel?.querySelector(`[data-matrix-setting="${name}"]`);

  const setMatrixStatus = (message) => {
    if (matrixStatus) matrixStatus.textContent = message;
  };

  const saveMatrixSettings = () => {
    localStorage.setItem(matrixStorageKey, JSON.stringify(matrixSettings));
  };

  const saveMatrixCustomQuotes = () => {
    localStorage.setItem(
      matrixCustomQuotesKey,
      JSON.stringify(matrixCustomQuotes),
    );
  };

  const renderMatrixCustomQuotes = () => {
    if (!matrixCustomQuoteList) return;
    matrixCustomQuoteList.replaceChildren();
    matrixCustomQuotes.forEach((quote) => {
      const item = document.createElement("li");
      const summary = document.createElement("span");
      const remove = document.createElement("button");
      summary.textContent = `${quote.text} — ${quote.author || "anonymous"}`;
      summary.title = summary.textContent;
      remove.type = "button";
      remove.textContent = "remove";
      remove.setAttribute("aria-label", `Remove quote: ${quote.text}`);
      remove.addEventListener("click", () => {
        matrixCustomQuotes = matrixCustomQuotes.filter(
          (candidate) => candidate.id !== quote.id,
        );
        saveMatrixCustomQuotes();
        renderMatrixCustomQuotes();
      });
      item.append(summary, remove);
      matrixCustomQuoteList.append(item);
    });
  };

  matrixSettingsPanel
    ?.querySelector("[data-matrix-custom-add]")
    ?.addEventListener("click", () => {
      const text = matrixCustomQuoteInput?.value.trim();
      const author = matrixCustomAuthorInput?.value.trim();
      if (!text) {
        matrixCustomQuoteInput?.focus();
        setMatrixStatus("enter a quote before adding it");
        return;
      }
      matrixCustomQuotes.push({
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
        text: text.slice(0, 500),
        author: (author || "Your library").slice(0, 80),
        sourceLabel: "Your library",
      });
      matrixCustomQuotes = matrixCustomQuotes.slice(-30);
      saveMatrixCustomQuotes();
      renderMatrixCustomQuotes();
      matrixCustomQuoteInput.value = "";
      matrixCustomAuthorInput.value = "";
      setMatrixStatus("quote added to the local rotation");
    });

  const chooseMatrixIntroQuote = () => {
    const firstLaunch = !localStorage.getItem(matrixIntroSeenKey);
    if (firstLaunch || !matrixSettings.randomQuotes) return matrixQuotes[0];
    const pool = [...matrixQuotes, ...matrixCustomQuotes];
    const randomValues = new Uint32Array(1);
    globalThis.crypto?.getRandomValues?.(randomValues);
    const randomIndex = globalThis.crypto?.getRandomValues
      ? randomValues[0] % pool.length
      : Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
  };

  const hideMatrixIntro = () => {
    window.clearTimeout(matrixIntroTimer);
    window.clearTimeout(matrixIntroHideTimer);
    if (!matrixIntro || matrixIntro.hidden) return;
    matrixIntro.classList.remove("is-visible");
    matrixIntro.classList.add("is-leaving");
    matrixIntroHideTimer = window.setTimeout(
      () => {
        matrixIntro.hidden = true;
        matrixIntro.classList.remove("is-leaving");
        matrixUI?.classList.remove("has-intro");
        matrixUI?.focus({ preventScroll: true });
        scheduleMatrixIdle();
      },
      reducedMotion.matches ? 20 : 920,
    );
  };

  const showMatrixIntro = () => {
    if (!matrixIntro || !matrixSettings.quotesEnabled) return;
    const quote = chooseMatrixIntroQuote();
    const quoteIndex = Math.max(
      0,
      [...matrixQuotes, ...matrixCustomQuotes].findIndex(
        (candidate) => candidate.id === quote.id,
      ),
    );
    matrixIntroQuote.textContent = quote.text;
    matrixIntroAuthor.textContent = `— ${quote.author}`;
    matrixIntroCounter.textContent = String(quoteIndex + 1).padStart(2, "0");
    if (quote.sourceURL) {
      matrixIntroSource.href = quote.sourceURL;
      matrixIntroSource.textContent = quote.sourceLabel || "source";
      matrixIntroSource.hidden = false;
    } else {
      matrixIntroSource.hidden = true;
      matrixIntroSource.removeAttribute("href");
    }
    matrixIntro.style.setProperty(
      "--matrix-intro-duration",
      `${matrixSettings.introDuration}s`,
    );
    window.clearTimeout(matrixIdleTimer);
    root.classList.remove("matrix-controls-idle");
    matrixUI?.classList.remove("is-idle");
    matrixUI?.classList.add("has-intro");
    matrixIntro.hidden = false;
    matrixIntro.classList.remove("is-leaving", "is-visible");
    window.requestAnimationFrame(() => {
      matrixIntro.classList.add("is-visible");
      matrixIntro
        .querySelector("[data-matrix-intro-skip]")
        ?.focus({ preventScroll: true });
    });
    localStorage.setItem(matrixIntroSeenKey, "true");
    matrixIntroTimer = window.setTimeout(
      hideMatrixIntro,
      matrixSettings.introDuration * 1000,
    );
  };

  matrixIntro
    ?.querySelector("[data-matrix-intro-skip]")
    ?.addEventListener("click", hideMatrixIntro);

  const stopMatrixAudioVisualizer = () => {
    window.cancelAnimationFrame(matrixAudioFrame);
    matrixAudioFrame = undefined;
    matrixAudioStream?.getTracks().forEach((track) => track.stop());
    matrixAudioStream = undefined;
    matrixAudioAnalyser = undefined;
    matrixAudioData = undefined;
    matrixAudioContext?.close().catch(() => {});
    matrixAudioContext = undefined;
    if (matrixAudioCanvas) matrixAudioCanvas.hidden = true;
  };

  const drawMatrixAudioVisualizer = () => {
    if (!matrixAudioCanvas || !matrixAudioAnalyser || !matrixAudioData) return;
    const context = matrixAudioCanvas.getContext("2d");
    if (!context) return;
    const rect = matrixAudioCanvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (
      matrixAudioCanvas.width !== Math.round(width * pixelRatio) ||
      matrixAudioCanvas.height !== Math.round(height * pixelRatio)
    ) {
      matrixAudioCanvas.width = Math.round(width * pixelRatio);
      matrixAudioCanvas.height = Math.round(height * pixelRatio);
    }
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    matrixAudioAnalyser.getByteFrequencyData(matrixAudioData);

    const [red, green, blue] = matrixSettings.color
      .slice(1)
      .match(/.{2}/g)
      .map((part) => Number.parseInt(part, 16));
    const bars = Math.max(24, Math.min(72, Math.floor(width / 10)));
    const gap = 3;
    const barWidth = Math.max(2, (width - gap * (bars - 1)) / bars);
    context.fillStyle = `rgba(${red}, ${green}, ${blue}, 0.82)`;
    context.shadowColor = `rgba(${red}, ${green}, ${blue}, 0.38)`;
    context.shadowBlur = 7;

    for (let index = 0; index < bars; index += 1) {
      const distance = Math.abs(index - (bars - 1) / 2) / (bars / 2);
      const frequencyIndex = Math.min(
        matrixAudioData.length - 1,
        Math.floor(Math.pow(distance, 1.45) * matrixAudioData.length * 0.72),
      );
      const level = Math.min(
        1,
        (matrixAudioData[frequencyIndex] / 255) *
          matrixSettings.audioSensitivity,
      );
      const barHeight = Math.max(1, Math.pow(level, 1.35) * height * 0.92);
      const x = index * (barWidth + gap);
      context.fillRect(x, height - barHeight, barWidth, barHeight);
    }
    matrixAudioFrame = window.requestAnimationFrame(drawMatrixAudioVisualizer);
  };

  const startMatrixAudioVisualizer = async () => {
    if (!matrixAudioCanvas || matrixMode !== "immersive") return;
    if (matrixAudioAnalyser) {
      matrixAudioCanvas.hidden = false;
      matrixAudioContext?.resume().catch(() => {});
      if (!matrixAudioFrame) drawMatrixAudioVisualizer();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      matrixSettings.audioReactive = false;
      syncMatrixControls();
      saveMatrixSettings();
      setMatrixStatus("microphone visualization is unavailable");
      return;
    }
    try {
      matrixAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
        video: false,
      });
      if (!matrixSettings.audioReactive || matrixMode !== "immersive") {
        matrixAudioStream.getTracks().forEach((track) => track.stop());
        matrixAudioStream = undefined;
        return;
      }
      matrixAudioContext = new AudioContext();
      const source =
        matrixAudioContext.createMediaStreamSource(matrixAudioStream);
      matrixAudioAnalyser = matrixAudioContext.createAnalyser();
      matrixAudioAnalyser.fftSize = 256;
      matrixAudioAnalyser.smoothingTimeConstant = 0.82;
      matrixAudioData = new Uint8Array(matrixAudioAnalyser.frequencyBinCount);
      source.connect(matrixAudioAnalyser);
      matrixAudioCanvas.hidden = false;
      drawMatrixAudioVisualizer();
      setMatrixStatus("microphone spectrum · processed locally");
    } catch {
      stopMatrixAudioVisualizer();
      matrixSettings.audioReactive = false;
      syncMatrixControls();
      saveMatrixSettings();
      setMatrixStatus("microphone permission was not granted");
    }
  };

  const syncMatrixAudioVisualizer = () => {
    if (matrixSettings.audioReactive && matrixMode === "immersive") {
      startMatrixAudioVisualizer();
    } else {
      stopMatrixAudioVisualizer();
    }
  };

  renderMatrixCustomQuotes();

  const syncMatrixOutputs = () => {
    const signed = (value) => Number(value).toFixed(2).replace("-", "−");
    const values = {
      color: matrixControl("color")?.value,
      speed: `${Number(matrixControl("speed")?.value).toFixed(2)}×`,
      charSize: `${matrixControl("charSize")?.value} px`,
      cycleSpeed: Number(matrixControl("cycleSpeed")?.value).toFixed(3),
      trail: Number(matrixControl("trail")?.value).toFixed(1),
      slant: `${matrixControl("slant")?.value}°`,
      glow: `${Math.round(Number(matrixControl("glow")?.value) * 100)}%`,
      brightness: signed(matrixControl("brightness")?.value),
      contrast: Number(matrixControl("contrast")?.value).toFixed(2),
      spacing: Number(matrixControl("spacing")?.value).toFixed(2),
      beaconColor: matrixControl("beaconColor")?.value,
      beaconIntensity: `${Number(
        matrixControl("beaconIntensity")?.value,
      ).toFixed(1)}×`,
      ambientOpacity: `${Math.round(
        Number(matrixControl("ambientOpacity")?.value) * 100,
      )}%`,
      vignette: `${Math.round(
        Number(matrixControl("vignette")?.value) * 100,
      )}%`,
      introDuration: `${matrixControl("introDuration")?.value} sec`,
      audioSensitivity: `${Number(
        matrixControl("audioSensitivity")?.value,
      ).toFixed(1)}×`,
    };

    Object.entries(values).forEach(([name, value]) => {
      const output = matrixSettingsPanel?.querySelector(
        `[data-matrix-output="${name}"]`,
      );
      if (output) output.textContent = value || "";
    });
  };

  const syncMatrixControls = () => {
    Object.entries(matrixSettings).forEach(([name, value]) => {
      const control = matrixControl(name);
      if (!control) return;
      if (control.type === "checkbox") control.checked = Boolean(value);
      else control.value = String(value);
    });
    const beaconOptions = document.querySelector(
      "[data-matrix-beacon-options]",
    );
    beaconOptions?.classList.toggle("is-disabled", !matrixSettings.beacon);
    beaconOptions
      ?.querySelectorAll("input")
      .forEach((control) => (control.disabled = !matrixSettings.beacon));
    matrixAudioOptions?.classList.toggle(
      "is-disabled",
      !matrixSettings.audioReactive,
    );
    matrixAudioOptions
      ?.querySelectorAll("input")
      .forEach((control) => (control.disabled = !matrixSettings.audioReactive));
    syncMatrixOutputs();
  };

  const readMatrixControls = () =>
    normalizeMatrixSettings({
      preset: matrixControl("preset")?.value,
      color: matrixControl("color")?.value,
      speed: matrixControl("speed")?.value,
      charSize: matrixControl("charSize")?.value,
      cycleSpeed: matrixControl("cycleSpeed")?.value,
      trail: matrixControl("trail")?.value,
      slant: matrixControl("slant")?.value,
      glow: matrixControl("glow")?.value,
      brightness: matrixControl("brightness")?.value,
      contrast: matrixControl("contrast")?.value,
      spacing: matrixControl("spacing")?.value,
      quality: matrixControl("quality")?.value,
      beacon: matrixControl("beacon")?.checked,
      beaconColor: matrixControl("beaconColor")?.value,
      beaconIntensity: matrixControl("beaconIntensity")?.value,
      ambientOpacity: matrixControl("ambientOpacity")?.value,
      vignette: matrixControl("vignette")?.value,
      scanlines: matrixControl("scanlines")?.checked,
      animate: matrixControl("animate")?.checked,
      autoHide: matrixControl("autoHide")?.checked,
      quotesEnabled: matrixControl("quotesEnabled")?.checked,
      randomQuotes: matrixControl("randomQuotes")?.checked,
      introDuration: matrixControl("introDuration")?.value,
      audioReactive: matrixControl("audioReactive")?.checked,
      audioSensitivity: matrixControl("audioSensitivity")?.value,
    });

  const hexToRGB = (hex) =>
    hex
      .slice(1)
      .match(/.{2}/g)
      .map((part) => Number.parseInt(part, 16) / 255);

  const buildMatrixURL = () => {
    const url = new URL(matrixToggle.dataset.matrixSrc, window.location.href);
    const [red, green, blue] = hexToRGB(matrixSettings.color);
    const dim = [red, green, blue].map((value) => value * 0.22);
    const cursor = hexToRGB(matrixSettings.beaconColor);
    const quality = matrixQuality[matrixSettings.quality];
    const columns = Math.round(
      clamp(window.innerHeight / matrixSettings.charSize, 32, 160, 80),
    );

    url.search = new URLSearchParams({
      renderer: "regl",
      version: "classic",
      font: "matrixcode",
      numColumns: String(columns),
      fallSpeed: String(matrixSettings.speed),
      cycleSpeed: String(matrixSettings.cycleSpeed),
      raindropLength: String(matrixSettings.trail),
      slant: String(matrixSettings.slant),
      bloomSize: "0.38",
      bloomStrength: String(matrixSettings.glow),
      baseBrightness: String(matrixSettings.brightness),
      baseContrast: String(matrixSettings.contrast),
      glyphVerticalSpacing: String(matrixSettings.spacing),
      isolateCursor: String(matrixSettings.beacon),
      cursorIntensity: String(matrixSettings.beaconIntensity),
      resolution: String(quality.resolution),
      fps: String(quality.fps),
      paletteRGB: [0, 0, 0, 0, ...dim, 0.45, red, green, blue, 1].join(","),
      cursorRGB: cursor.join(","),
      backgroundRGB: "0,0,0",
      suppressWarnings: "true",
    }).toString();

    return url.href;
  };

  const applyMatrixSurface = () => {
    if (!matrixLayer) return;
    matrixLayer.style.setProperty(
      "--matrix-ambient-opacity",
      matrixSettings.ambientOpacity,
    );
    matrixLayer.style.setProperty(
      "--matrix-vignette-strength",
      matrixSettings.vignette,
    );
    matrixLayer.classList.toggle("has-scanlines", matrixSettings.scanlines);
  };

  const setMatrixPaused = () => {
    if (!matrixFrame?.contentWindow) return;
    matrixFrame.contentWindow.postMessage(
      {
        type: "matrix:set-paused",
        paused: !matrixSettings.animate,
      },
      window.location.origin,
    );
    if (matrixSettings.animate) {
      const quality = matrixQuality[matrixSettings.quality];
      setMatrixStatus(
        `live signal · ${matrixSettings.charSize}px glyphs · ${quality.fps} fps`,
      );
    } else {
      setMatrixStatus("signal paused · live frame");
    }
  };

  const loadMatrix = () => {
    if (!matrixFrame || !matrixLayer || matrixMode === "off") return;

    applyMatrixSurface();
    const source = buildMatrixURL();
    if (matrixFrame.getAttribute("src") === source) {
      setMatrixPaused();
      return;
    }
    setMatrixStatus("rebuilding signal…");
    matrixFrame.src = source;
  };

  const scheduleMatrixIdle = () => {
    window.clearTimeout(matrixIdleTimer);
    matrixUI?.classList.remove("is-idle");
    root.classList.remove("matrix-controls-idle");
    if (
      matrixMode !== "off" &&
      matrixSettings.autoHide &&
      matrixSettingsPanel?.hidden &&
      matrixIntro?.hidden !== false
    ) {
      matrixIdleTimer = window.setTimeout(() => {
        if (
          matrixMode === "immersive" &&
          !matrixKeyboardNavigation &&
          matrixUI?.contains(document.activeElement)
        ) {
          matrixUI.focus({ preventScroll: true });
        }
        matrixUI.classList.add("is-idle");
        if (matrixMode === "immersive") {
          root.classList.add("matrix-controls-idle");
        }
      }, 3200);
    }
  };

  const setMatrixSettingsOpen = (open, restoreFocus = true) => {
    if (!matrixSettingsPanel || !matrixSettingsToggle) return;
    matrixSettingsPanel.hidden = !open;
    matrixSettingsToggles.forEach((toggle) =>
      toggle.setAttribute("aria-expanded", String(open)),
    );
    matrixUI?.classList.toggle("has-settings-open", open);
    scheduleMatrixIdle();
    if (open) matrixControl("preset")?.focus({ preventScroll: true });
    else if (restoreFocus) {
      matrixSettingsToggles
        .find((toggle) => toggle.offsetParent !== null)
        ?.focus({ preventScroll: true });
    }
  };

  const toggleMatrixFullscreen = async () => {
    if (!matrixLayer) return;
    try {
      if (document.fullscreenElement === root) {
        await document.exitFullscreen();
      } else {
        await root.requestFullscreen();
      }
    } catch {
      setMatrixStatus("fullscreen unavailable in this browser");
    }
  };

  const setMatrixModeMenu = (open, focusMenu = false) => {
    if (!matrixModeMenu || !matrixToggle) return;
    matrixModeMenu.hidden = !open;
    matrixToggle.setAttribute("aria-expanded", String(open));
    matrixLauncher?.classList.toggle("is-open", open);
    if (open && focusMenu) {
      matrixModeMenu.querySelector("button")?.focus({ preventScroll: true });
    }
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    matrixInstallPrompt = event;
    syncMatrixInstallButtons();
  });

  window.addEventListener("appinstalled", () => {
    matrixInstallPrompt = undefined;
    syncMatrixInstallButtons();
    setMatrixStatus("Matrix Immersive installed");
  });

  matrixInstallButtons.forEach((button) =>
    button.addEventListener("click", async () => {
      if (!matrixInstallPrompt) return;
      setMatrixModeMenu(false);
      await matrixInstallPrompt.prompt();
      const { outcome } = await matrixInstallPrompt.userChoice;
      matrixInstallPrompt = undefined;
      syncMatrixInstallButtons();
      setMatrixStatus(
        outcome === "accepted"
          ? "install accepted · launching from Chrome apps"
          : "installation cancelled",
      );
    }),
  );

  const setMatrixMode = (nextMode, persist = true) => {
    const requestedMode = ["ambient", "immersive"].includes(nextMode)
      ? nextMode
      : "off";
    const next =
      requestedMode !== "off" &&
      matrixToggle &&
      matrixLayer &&
      matrixFrame &&
      matrixUI
        ? requestedMode
        : "off";
    const wasOff = matrixMode === "off";
    matrixMode = next;
    if (matrixMode !== "off") matrixLastMode = matrixMode;

    if (matrixMode !== "off" && root.dataset.theme !== "dark") {
      localStorage.setItem("theme", "dark");
      setTheme("dark");
    }

    const active = matrixMode !== "off";
    const immersive = matrixMode === "immersive";
    root.classList.toggle("matrix-active", active);
    root.classList.toggle("matrix-ambient", matrixMode === "ambient");
    root.classList.toggle("matrix-immersive", immersive);
    matrixLayer.classList.toggle("is-ambient", matrixMode === "ambient");
    matrixLayer.classList.toggle("is-immersive", immersive);
    matrixUI.classList.toggle("is-ambient", matrixMode === "ambient");
    matrixUI.classList.toggle("is-immersive", immersive);
    matrixToggle?.classList.toggle("is-active", active);
    matrixToggle?.setAttribute("aria-pressed", String(active));
    matrixToggle?.setAttribute(
      "title",
      active ? `Matrix ${matrixMode} mode active` : "Choose Matrix experience",
    );

    matrixLayer.hidden = !active;
    matrixUI.hidden = !active;
    matrixUI.setAttribute("role", immersive ? "dialog" : "region");
    matrixUI.setAttribute(
      "aria-label",
      immersive ? "Immersive Matrix digital rain" : "Ambient Matrix controls",
    );
    matrixUI.toggleAttribute("aria-modal", immersive);
    siteShell?.toggleAttribute("inert", immersive);
    focusPlayerPanel?.toggleAttribute("inert", immersive);
    if (immersive) siteShell?.setAttribute("aria-hidden", "true");
    else siteShell?.removeAttribute("aria-hidden");
    if (immersive) focusPlayerPanel?.setAttribute("aria-hidden", "true");
    else focusPlayerPanel?.removeAttribute("aria-hidden");

    if (active) {
      if (wasOff) matrixLastFocus = matrixToggle;
      syncMatrixControls();
      loadMatrix();
      if (immersive) {
        scheduleMatrixIdle();
        window.setTimeout(() => matrixUI.focus({ preventScroll: true }), 0);
      } else {
        window.clearTimeout(matrixIdleTimer);
        matrixUI.classList.remove("is-idle");
        root.classList.remove("matrix-controls-idle");
        if (document.fullscreenElement === root) {
          document.exitFullscreen().catch(() => {});
        }
        scheduleMatrixIdle();
      }
    } else {
      window.clearTimeout(matrixIdleTimer);
      matrixUI.classList.remove("is-idle");
      root.classList.remove("matrix-controls-idle");
      setMatrixSettingsOpen(false, false);
      matrixFrame.removeAttribute("src");
      if (document.fullscreenElement === root) {
        document.exitFullscreen().catch(() => {});
      }
      if (!wasOff) {
        (matrixLastFocus || matrixToggle)?.focus?.({ preventScroll: true });
      }
    }

    if (!immersive) hideMatrixIntro();
    syncMatrixAudioVisualizer();

    document.querySelectorAll("[data-matrix-mode-choice]").forEach((choice) => {
      const selected = choice.dataset.matrixModeChoice === matrixMode;
      choice.classList.toggle("is-current", selected);
      choice.setAttribute("aria-current", selected ? "true" : "false");
    });
    setMatrixModeMenu(false);
    if (matrixMode === "ambient" && matrixKeyboardNavigation) {
      window.setTimeout(
        () =>
          matrixUI
            .querySelector("[data-matrix-ambient-dock] button")
            ?.focus({ preventScroll: true }),
        0,
      );
    }

    if (persist) {
      localStorage.setItem("matrix-mode", matrixMode);
    }
  };

  setTheme(storedTheme || preferredTheme);
  const matrixRequested = new URLSearchParams(window.location.search).get(
    "matrix",
  );
  const matrixAppRequested =
    new URLSearchParams(window.location.search).get("app") === "matrix";
  const storedMatrixMode = localStorage.getItem("matrix-mode");
  setMatrixMode(
    matrixAppDisplay || matrixAppRequested
      ? "immersive"
      : matrixRequested === "ambient"
        ? "ambient"
        : matrixRequested !== null
          ? "immersive"
          : storedMatrixMode === "on"
            ? "immersive"
            : storedMatrixMode,
    false,
  );
  if (matrixAppDisplay || matrixAppRequested) {
    window.setTimeout(showMatrixIntro, reducedMotion.matches ? 20 : 420);
  }

  toggle?.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    if (next === "light" && matrixMode !== "off") setMatrixMode("off");
    localStorage.setItem("theme", next);
    setTheme(next);
  });

  const preferredThemeQuery = window.matchMedia(
    "(prefers-color-scheme: light)",
  );
  preferredThemeQuery.addEventListener?.("change", (event) => {
    if (!localStorage.getItem("theme"))
      setTheme(event.matches ? "light" : "dark");
  });

  menuToggle?.addEventListener("click", () => {
    setMatrixModeMenu(false);
    setSiteNavigation(!siteNavigation?.classList.contains("is-open"));
  });

  siteNavigation
    ?.querySelectorAll("a")
    .forEach((link) =>
      link.addEventListener("click", () => setSiteNavigation(false)),
    );

  let headerFrame;
  const syncHeaderState = () => {
    window.cancelAnimationFrame(headerFrame);
    headerFrame = window.requestAnimationFrame(() => {
      siteHeader?.classList.toggle("is-scrolled", window.scrollY > 12);
    });
  };
  window.addEventListener("scroll", syncHeaderState, { passive: true });
  syncHeaderState();

  const articleContent = document.querySelector("[data-article-content]");
  const readingProgress = document.querySelector("[data-reading-progress]");
  const articleToc = document.querySelector("[data-article-toc]");
  if (articleToc) {
    const compactToc = window.matchMedia("(max-width: 760px)");
    const syncArticleToc = () => {
      articleToc.open = !compactToc.matches;
    };
    syncArticleToc();
    compactToc.addEventListener?.("change", syncArticleToc);
  }
  let readingFrame;
  const syncReadingProgress = () => {
    if (!articleContent || !readingProgress) return;
    window.cancelAnimationFrame(readingFrame);
    readingFrame = window.requestAnimationFrame(() => {
      const rect = articleContent.getBoundingClientRect();
      const start = window.scrollY + rect.top - window.innerHeight * 0.25;
      const distance = Math.max(
        1,
        articleContent.offsetHeight - window.innerHeight * 0.55,
      );
      const progressValue = Math.min(
        1,
        Math.max(0, (window.scrollY - start) / distance),
      );
      readingProgress.style.setProperty(
        "--reading-progress",
        `${Math.round(progressValue * 100)}%`,
      );
    });
  };
  if (articleContent) {
    window.addEventListener("scroll", syncReadingProgress, { passive: true });
    window.addEventListener("resize", syncReadingProgress);
    syncReadingProgress();
  }

  const sectionLinks = [...document.querySelectorAll("[data-nav-section]")];
  const observedSections = sectionLinks
    .map((link) => document.getElementById(link.dataset.navSection))
    .filter(Boolean);
  if ("IntersectionObserver" in window && observedSections.length) {
    const visibleSections = new Map();
    const syncCurrentSection = () => {
      const current = [...visibleSections.entries()]
        .filter(([, visible]) => visible)
        .map(([section]) => section)
        .sort(
          (first, second) =>
            Math.abs(first.getBoundingClientRect().top) -
            Math.abs(second.getBoundingClientRect().top),
        )[0];
      sectionLinks.forEach((link) => {
        if (current?.id === link.dataset.navSection)
          link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    };
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) =>
          visibleSections.set(entry.target, entry.isIntersecting),
        );
        syncCurrentSection();
      },
      { rootMargin: "-22% 0px -62%", threshold: 0 },
    );
    observedSections.forEach((section) => sectionObserver.observe(section));
  }

  matrixToggle?.addEventListener("click", () => {
    setSiteNavigation(false);
    setMatrixModeMenu(matrixModeMenu?.hidden, matrixKeyboardNavigation);
  });
  document
    .querySelectorAll("[data-matrix-mode-choice]")
    .forEach((choice) =>
      choice.addEventListener("click", () =>
        setMatrixMode(choice.dataset.matrixModeChoice),
      ),
    );
  matrixUI
    ?.querySelectorAll("[data-matrix-close]")
    .forEach((button) =>
      button.addEventListener("click", () => setMatrixMode("off")),
    );
  matrixSettingsToggles.forEach((button) =>
    button.addEventListener("click", () =>
      setMatrixSettingsOpen(matrixSettingsPanel.hidden),
    ),
  );
  matrixUI
    ?.querySelector("[data-matrix-settings-close]")
    ?.addEventListener("click", () => setMatrixSettingsOpen(false));
  matrixUI
    ?.querySelector("[data-matrix-ambient]")
    ?.addEventListener("click", () => setMatrixMode("ambient"));
  matrixUI
    ?.querySelector("[data-matrix-immersive]")
    ?.addEventListener("click", () => setMatrixMode("immersive"));
  matrixFullscreen?.addEventListener("click", toggleMatrixFullscreen);
  matrixUI
    ?.querySelector("[data-matrix-reset]")
    ?.addEventListener("click", () => {
      matrixSettings = {
        ...matrixDefaults,
        animate: !reducedMotion.matches,
      };
      syncMatrixControls();
      saveMatrixSettings();
      loadMatrix();
      syncMatrixAudioVisualizer();
      scheduleMatrixIdle();
    });

  matrixSettingsPanel?.addEventListener("input", () => {
    syncMatrixOutputs();
    window.clearTimeout(matrixReloadTimer);
    matrixReloadTimer = window.setTimeout(() => {
      const preview = readMatrixControls();
      matrixSettings.ambientOpacity = preview.ambientOpacity;
      matrixSettings.vignette = preview.vignette;
      matrixSettings.scanlines = preview.scanlines;
      applyMatrixSurface();
    }, 24);
  });
  matrixSettingsPanel?.addEventListener("change", (event) => {
    const setting = event.target.dataset.matrixSetting;
    if (!setting) return;

    if (setting === "preset" && matrixPresets[event.target.value]) {
      matrixSettings = {
        ...matrixSettings,
        ...matrixPresets[event.target.value],
        preset: event.target.value,
      };
      syncMatrixControls();
    } else {
      matrixSettings = readMatrixControls();
      if (
        ![
          "animate",
          "autoHide",
          "scanlines",
          "ambientOpacity",
          "vignette",
          "beacon",
          "beaconColor",
          "beaconIntensity",
          "quotesEnabled",
          "randomQuotes",
          "introDuration",
          "audioReactive",
          "audioSensitivity",
        ].includes(setting)
      ) {
        matrixSettings.preset = "custom";
        matrixControl("preset").value = "custom";
      }
    }

    syncMatrixControls();
    saveMatrixSettings();
    if (setting === "audioReactive") syncMatrixAudioVisualizer();
    if (setting === "quotesEnabled" && !matrixSettings.quotesEnabled) {
      hideMatrixIntro();
    }
    if (
      ![
        "quotesEnabled",
        "randomQuotes",
        "introDuration",
        "audioReactive",
        "audioSensitivity",
      ].includes(setting)
    ) {
      loadMatrix();
    }
    scheduleMatrixIdle();
  });

  ["pointermove", "pointerdown", "touchstart"].forEach((eventName) =>
    document.addEventListener(
      eventName,
      () => {
        matrixKeyboardNavigation = false;
        scheduleMatrixIdle();
      },
      { passive: true },
    ),
  );

  matrixFrame?.addEventListener("load", () => {
    if (matrixMode === "off") return;
    const quality = matrixQuality[matrixSettings.quality];
    window.setTimeout(setMatrixPaused, 80);
    if (matrixSettings.animate) {
      setMatrixStatus(
        `live signal · ${matrixSettings.charSize}px glyphs · ${quality.fps} fps`,
      );
    }
  });

  document.addEventListener("fullscreenchange", () => {
    if (matrixFullscreen) {
      matrixFullscreen.textContent =
        document.fullscreenElement === root ? "windowed" : "fullscreen";
    }
    scheduleMatrixIdle();
  });

  document.addEventListener("keydown", (event) => {
    matrixKeyboardNavigation = true;
    const isFormControl = ["INPUT", "SELECT", "TEXTAREA"].includes(
      event.target.tagName,
    );

    if (
      event.key === "Escape" &&
      siteNavigation?.classList.contains("is-open")
    ) {
      event.preventDefault();
      setSiteNavigation(false, true);
      return;
    }

    if (matrixIntro?.hidden === false && event.key === "Escape") {
      event.preventDefault();
      hideMatrixIntro();
      return;
    }

    if (event.key === "Escape" && !matrixModeMenu?.hidden) {
      event.preventDefault();
      setMatrixModeMenu(false);
      matrixToggle?.focus({ preventScroll: true });
      return;
    }

    if (
      !matrixModeMenu?.hidden &&
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    ) {
      event.preventDefault();
      const choices = [...matrixModeMenu.querySelectorAll("button")];
      const current = choices.indexOf(document.activeElement);
      const nextIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? choices.length - 1
            : event.key === "ArrowDown"
              ? (current + 1) % choices.length
              : (current - 1 + choices.length) % choices.length;
      choices[nextIndex]?.focus({ preventScroll: true });
      return;
    }

    if (matrixMode === "off") {
      if (event.key.toLowerCase() === "m" && !isFormControl) {
        event.preventDefault();
        setMatrixMode(matrixLastMode);
      }
      return;
    }

    scheduleMatrixIdle();
    if (event.key === "Escape") {
      event.preventDefault();
      if (!matrixSettingsPanel.hidden) setMatrixSettingsOpen(false);
      else if (!(matrixAppDisplay || matrixAppRequested)) setMatrixMode("off");
      return;
    }
    if (!isFormControl && event.key.toLowerCase() === "m") {
      event.preventDefault();
      if (!(matrixAppDisplay || matrixAppRequested)) setMatrixMode("off");
      return;
    }
    if (!isFormControl && event.key.toLowerCase() === "s") {
      event.preventDefault();
      setMatrixSettingsOpen(matrixSettingsPanel.hidden);
      return;
    }
    if (!isFormControl && event.key.toLowerCase() === "f") {
      event.preventDefault();
      if (matrixMode === "ambient") setMatrixMode("immersive");
      toggleMatrixFullscreen();
      return;
    }

    if (event.key === "Tab" && matrixMode === "immersive") {
      const focusable = [
        ...matrixUI.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  reducedMotion.addEventListener?.("change", () => {
    if (reducedMotion.matches) {
      matrixSettings.animate = false;
      saveMatrixSettings();
      syncMatrixControls();
      if (matrixMode !== "off") loadMatrix();
    } else if (matrixMode !== "off" && matrixSettings.animate) {
      loadMatrix();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!matrixAudioContext) return;
    if (document.hidden) matrixAudioContext.suspend().catch(() => {});
    else if (matrixSettings.audioReactive && matrixMode === "immersive") {
      matrixAudioContext.resume().catch(() => {});
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!matrixLauncher?.contains(event.target)) setMatrixModeMenu(false);
    if (
      !siteNavigation?.contains(event.target) &&
      !menuToggle?.contains(event.target)
    )
      setSiteNavigation(false);
  });

  window.addEventListener("resize", () => {
    window.clearTimeout(matrixResizeTimer);
    matrixResizeTimer = window.setTimeout(() => {
      if (matrixMode !== "off") loadMatrix();
    }, 180);
  });

  const timeNode = document.querySelector("[data-local-time]");
  if (timeNode) {
    const updateTime = () => {
      timeNode.textContent = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Tehran",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date());
    };
    updateTime();
    window.setInterval(updateTime, 1000);
  }

  const episodesNode = document.querySelector("[data-player-episodes]");
  let episodes = [];

  try {
    const parsedEpisodes = JSON.parse(episodesNode?.textContent || "[]");
    if (Array.isArray(parsedEpisodes)) {
      episodes = parsedEpisodes
        .filter(
          (episode) =>
            typeof episode.title === "string" &&
            typeof episode.url === "string" &&
            Number.isFinite(Number(episode.duration)),
        )
        .map((episode) => ({
          ...episode,
          duration: Number(episode.duration),
        }));
    }
  } catch {
    // Hugo supplies a local fallback, so this only guards malformed markup.
  }

  const frequencyMoods = {
    focus: {
      label: "Focus",
      carrier: 200,
      beat: 14,
      band: "beta",
      description: "steady attention",
    },
    "deep-work": {
      label: "Deep work",
      carrier: 160,
      beat: 10,
      band: "alpha",
      description: "sustained flow",
    },
    calm: {
      label: "Calm",
      carrier: 174,
      beat: 7,
      band: "theta",
      description: "gentle reset",
    },
    meditate: {
      label: "Meditate",
      carrier: 136.1,
      beat: 6,
      band: "theta",
      description: "quiet awareness",
    },
    sleep: {
      label: "Sleep",
      carrier: 110,
      beat: 2.5,
      band: "delta",
      description: "slow descent",
    },
    energy: {
      label: "Energy",
      carrier: 220,
      beat: 18,
      band: "beta",
      description: "active momentum",
    },
  };
  const frequencyVariations = {
    pure: {
      label: "Pure",
      carrierScale: 1,
      wave: "sine",
      harmonic: 0.008,
      harmonicRatio: 0.5,
      motion: 0.04,
      motionDepth: 0.25,
      noise: 0,
      noiseCutoff: 800,
    },
    warm: {
      label: "Warm",
      carrierScale: 1,
      wave: "sine",
      harmonic: 0.055,
      harmonicRatio: 0.5,
      motion: 0.07,
      motionDepth: 0.4,
      noise: 0.018,
      noiseCutoff: 720,
    },
    airy: {
      label: "Airy",
      carrierScale: 1.2,
      wave: "triangle",
      harmonic: 0.025,
      harmonicRatio: 1.5,
      motion: 0.11,
      motionDepth: 0.55,
      noise: 0.026,
      noiseCutoff: 2400,
    },
    deep: {
      label: "Deep",
      carrierScale: 0.75,
      wave: "sine",
      harmonic: 0.065,
      harmonicRatio: 0.5,
      motion: 0.035,
      motionDepth: 0.45,
      noise: 0.014,
      noiseCutoff: 480,
    },
  };
  const frequencyMoodKeys = Object.keys(frequencyMoods);
  const frequencyVariationKeys = Object.keys(frequencyVariations);

  const player = document.querySelector("[data-player]");
  const audio = player?.querySelector("[data-player-audio]");
  const playerToggle = document.querySelector("[data-player-toggle]");

  if (player && audio && playerToggle && episodes.length) {
    const titleNode = player.querySelector("[data-player-title]");
    const miniTitleNode = player.querySelector("[data-player-mini-title]");
    const statusNode = player.querySelector("[data-player-status]");
    const playIcons = [...player.querySelectorAll("[data-play-icon]")];
    const playButtons = [...player.querySelectorAll("[data-player-play]")];
    const previousButtons = [...player.querySelectorAll("[data-player-prev]")];
    const nextButtons = [...player.querySelectorAll("[data-player-next]")];
    const playerToggleLabel = playerToggle.querySelector("span:last-child");
    const episodeSelect = player.querySelector("[data-episode-select]");
    const progress = player.querySelector("[data-player-progress]");
    const currentTimeNode = player.querySelector("[data-current-time]");
    const durationNode = player.querySelector("[data-duration]");
    const volume = player.querySelector("[data-player-volume]");
    const sleepSelect = player.querySelector("[data-player-sleep]");
    const episodeSleepOption = sleepSelect.querySelector(
      'option[value="episode"]',
    );
    const positionNode = player.querySelector("[data-player-position]");
    const episodeSource = player.querySelector("[data-player-source]");
    const frequencyNote = player.querySelector("[data-frequency-note]");
    const playerLabel = player.querySelector("[data-player-label]");
    const playerSubtitle = player.querySelector("[data-player-subtitle]");
    const miniLabel = player.querySelector("[data-player-mini-label]");
    const kickerNode = player.querySelector("[data-player-kicker]");
    const moodSelect = player.querySelector("[data-frequency-mood]");
    const variationSelect = player.querySelector("[data-frequency-variation]");
    const frequencyReadout = player.querySelector("[data-frequency-readout]");
    const frequencyBand = player.querySelector("[data-frequency-band]");
    const modeButtons = [
      ...player.querySelectorAll("[data-player-mode-choice]"),
    ];
    const radioControls = [...player.querySelectorAll("[data-radio-controls]")];
    const frequencyControls = player.querySelector("[data-frequency-controls]");
    const secondaryButtons = [
      ...player.querySelectorAll("[data-player-secondary]"),
    ];
    const visualizerBars = [...player.querySelectorAll("[data-visualizer] i")];
    const FrequencyGenerator = window.FocusFrequencyGenerator;
    const frequencyGenerator = FrequencyGenerator
      ? new FrequencyGenerator()
      : null;
    const playerSessionKey = "focus-player-session-v1";
    let sleepTimer;
    let sleepMode = "off";
    let pendingStartTime = 0;
    let restoredSession;
    let playerClearanceFrame;

    const syncPlayerClearance = () => {
      window.cancelAnimationFrame(playerClearanceFrame);
      playerClearanceFrame = window.requestAnimationFrame(() => {
        if (player.hidden) {
          root.style.removeProperty("--focus-player-clearance");
          root.style.removeProperty("--focus-player-edge");
          return;
        }

        const playerRect = player.getBoundingClientRect();
        const playerStyle = window.getComputedStyle(player);
        const panelGap = 16;
        const minimumEdge = window.innerWidth <= 650 ? 12 : 24;
        const bottomOffset = Number.parseFloat(playerStyle.bottom) || 0;
        const clearance = Math.ceil(
          player.offsetHeight + bottomOffset + panelGap,
        );
        const edge = Math.ceil(
          Math.max(minimumEdge, window.innerWidth - playerRect.right),
        );
        root.style.setProperty(
          "--focus-player-clearance",
          `${Math.max(12, clearance)}px`,
        );
        root.style.setProperty("--focus-player-edge", `${edge}px`);
      });
    };

    if ("ResizeObserver" in window) {
      new ResizeObserver(syncPlayerClearance).observe(player);
    }
    window.addEventListener("resize", syncPlayerClearance);

    try {
      restoredSession = JSON.parse(
        sessionStorage.getItem(playerSessionKey) || "null",
      );
    } catch {
      restoredSession = null;
    }

    let playerMode =
      restoredSession?.mode ||
      localStorage.getItem("focus-player-mode") ||
      "radio";
    let moodKey =
      restoredSession?.mood ||
      localStorage.getItem("focus-frequency-mood") ||
      "focus";
    let variationKey =
      restoredSession?.variation ||
      localStorage.getItem("focus-frequency-variation") ||
      "pure";
    let episodeIndex = Number.parseInt(
      String(
        restoredSession?.episodeIndex ??
          localStorage.getItem("focus-episode") ??
          "0",
      ),
      10,
    );
    let loadedIndex = -1;

    if (!Number.isInteger(episodeIndex) || !episodes[episodeIndex])
      episodeIndex = 0;
    if (!["radio", "frequency"].includes(playerMode)) playerMode = "radio";
    if (!frequencyMoods[moodKey]) moodKey = "focus";
    if (!frequencyVariations[variationKey]) variationKey = "pure";
    episodeSelect.value = String(episodeIndex);
    moodSelect.value = moodKey;
    variationSelect.value = variationKey;

    const formatTime = (value) => {
      if (!Number.isFinite(value) || value < 0) return "00:00";
      const total = Math.floor(value);
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const seconds = total % 60;
      return hours
        ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    };

    const setStatus = (message) => {
      statusNode.textContent = message;
    };

    const setPlayingUI = (playing) => {
      player.classList.toggle("is-playing", playing);
      playerToggle.classList.toggle("is-playing", playing);
      playIcons.forEach((icon) => {
        icon.textContent = icon.closest(".player-mini")
          ? playing
            ? "Ⅱ"
            : "▶"
          : playing
            ? "PAUSE"
            : "PLAY";
      });
      playButtons.forEach((button) =>
        button.setAttribute("aria-label", playing ? "Pause" : "Play"),
      );
    };

    const syncEpisodeUI = () => {
      const episode = episodes[episodeIndex];
      titleNode.textContent = episode.title;
      if (miniTitleNode) miniTitleNode.textContent = episode.title;
      durationNode.textContent = formatTime(episode.duration);
      episodeSelect.value = String(episodeIndex);
      if (positionNode)
        positionNode.textContent = `${String(episodeIndex + 1).padStart(2, "0")} / ${String(episodes.length).padStart(2, "0")}`;
      if (episodeSource) episodeSource.href = episode.page;
      visualizerBars.forEach((bar) => bar.removeAttribute("style"));
      localStorage.setItem("focus-episode", String(episodeIndex));

      if ("mediaSession" in navigator && "MediaMetadata" in window) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: episode.title,
          artist: "Music For Programming",
          album: "musicforprogramming.net",
        });
      }
    };

    const syncFrequencyUI = () => {
      const mood = frequencyMoods[moodKey];
      const variation = frequencyVariations[variationKey];
      const carrier = mood.carrier * variation.carrierScale;
      titleNode.textContent = `${mood.label} · ${variation.label}`;
      miniTitleNode.textContent = `${mood.label} · ${variation.label}`;
      positionNode.textContent = `${mood.beat} HZ / ${mood.band.toUpperCase()}`;
      frequencyReadout.textContent = `${Number(carrier.toFixed(1))} Hz carrier`;
      frequencyBand.textContent = `${mood.beat} Hz · ${mood.band} · ${mood.description}`;
      moodSelect.value = moodKey;
      variationSelect.value = variationKey;
      const moodIndex = frequencyMoodKeys.indexOf(moodKey);
      const variationIndex = frequencyVariationKeys.indexOf(variationKey);
      visualizerBars.forEach((bar, index) => {
        const phase = (index * 17 + moodIndex * 23 + variationIndex * 31) % 79;
        bar.style.setProperty("--height", `${20 + phase}%`);
        bar.style.animationDuration = `${Math.max(0.38, 1.35 - mood.beat / 22 + (index % 5) * 0.08)}s`;
      });
      localStorage.setItem("focus-frequency-mood", moodKey);
      localStorage.setItem("focus-frequency-variation", variationKey);
      if (
        playerMode === "frequency" &&
        "mediaSession" in navigator &&
        "MediaMetadata" in window
      ) {
        if (typeof navigator.mediaSession.setPositionState === "function") {
          try {
            navigator.mediaSession.setPositionState();
          } catch {
            // Some browsers require an active media session before clearing.
          }
        }
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `${mood.label} · ${variation.label}`,
          artist: "Local frequency generator",
          album: `${mood.beat} Hz ${mood.band} beat`,
        });
      }
    };

    const syncModeUI = () => {
      const frequencyMode = playerMode === "frequency";
      player.dataset.playerMode = playerMode;
      radioControls.forEach((control) => (control.hidden = frequencyMode));
      frequencyControls.hidden = !frequencyMode;
      episodeSource.hidden = frequencyMode;
      frequencyNote.hidden = !frequencyMode;
      episodeSleepOption.disabled = frequencyMode;
      playerLabel.textContent = frequencyMode ? "frequency lab" : "focus radio";
      playerSubtitle.textContent = frequencyMode
        ? "generated locally"
        : "background playback";
      miniLabel.textContent = frequencyMode ? "frequency lab" : "focus radio";
      if (playerToggleLabel)
        playerToggleLabel.textContent = frequencyMode
          ? "frequency lab"
          : "focus radio";
      previousButtons.forEach((button) =>
        button.setAttribute(
          "aria-label",
          frequencyMode ? "Previous mood" : "Previous episode",
        ),
      );
      nextButtons.forEach((button) =>
        button.setAttribute(
          "aria-label",
          frequencyMode ? "Next mood" : "Next episode",
        ),
      );
      player
        .querySelectorAll("[data-player-minimize]")
        .forEach((button) =>
          button.setAttribute(
            "aria-label",
            `Minimize ${frequencyMode ? "frequency lab" : "focus radio"}`,
          ),
        );
      player
        .querySelectorAll("[data-player-expand]")
        .forEach((button) =>
          button.setAttribute(
            "aria-label",
            `Expand ${frequencyMode ? "frequency lab" : "focus radio"}`,
          ),
        );
      player
        .querySelectorAll("[data-player-close]")
        .forEach((button) =>
          button.setAttribute(
            "aria-label",
            `Stop and close ${frequencyMode ? "frequency lab" : "focus radio"}`,
          ),
        );
      kickerNode.textContent = frequencyMode
        ? "NOW GENERATING"
        : "NOW STREAMING";
      modeButtons.forEach((button) => {
        const active = button.dataset.playerModeChoice === playerMode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      secondaryButtons.forEach((button) => {
        const previous = button.dataset.playerSecondary === "-1";
        button.textContent = frequencyMode
          ? previous
            ? "VAR−"
            : "VAR+"
          : previous
            ? "−30"
            : "+30";
        button.setAttribute(
          "aria-label",
          frequencyMode
            ? `${previous ? "Previous" : "Next"} variation`
            : `${previous ? "Rewind" : "Forward"} 30 seconds`,
        );
      });
      if (frequencyMode) syncFrequencyUI();
      else syncEpisodeUI();
      localStorage.setItem("focus-player-mode", playerMode);
    };

    const persistPlayerSession = () => {
      if (player.hidden && loadedIndex < 0 && !frequencyGenerator?.playing)
        return;
      sessionStorage.setItem(
        playerSessionKey,
        JSON.stringify({
          mode: playerMode,
          mood: moodKey,
          variation: variationKey,
          episodeIndex,
          currentTime: Number.isFinite(audio.currentTime)
            ? audio.currentTime
            : 0,
          playing:
            playerMode === "frequency"
              ? Boolean(frequencyGenerator?.playing)
              : !audio.paused,
          view: player.classList.contains("is-minimized")
            ? "minimized"
            : player.hidden
              ? "hidden"
              : "expanded",
        }),
      );
    };

    const loadEpisode = (index, playAfter = false, startTime = 0) => {
      episodeIndex = (index + episodes.length) % episodes.length;
      loadedIndex = episodeIndex;
      pendingStartTime = Math.max(0, Number(startTime) || 0);
      audio.src = episodes[episodeIndex].url;
      audio.load();
      progress.value = "0";
      currentTimeNode.textContent = "00:00";
      syncEpisodeUI();
      setStatus("connecting to stream…");
      if (playAfter) {
        audio.play().catch(() => setStatus("tap play to continue"));
      }
    };

    const startFrequency = async () => {
      if (!frequencyGenerator?.supported) {
        setStatus("frequency generation is unavailable in this browser");
        return;
      }
      try {
        await frequencyGenerator.start(
          frequencyMoods[moodKey],
          frequencyVariations[variationKey],
        );
        setPlayingUI(true);
        setStatus("signal generated locally · use headphones");
        if ("mediaSession" in navigator)
          navigator.mediaSession.playbackState = "playing";
        persistPlayerSession();
      } catch {
        setPlayingUI(false);
        setStatus("tap play to enable browser audio");
      }
    };

    const stopFrequency = () => {
      frequencyGenerator?.stop();
      setPlayingUI(false);
      if ("mediaSession" in navigator)
        navigator.mediaSession.playbackState = "paused";
    };

    const setPlayerMode = (nextMode) => {
      if (nextMode === playerMode) return;
      window.clearTimeout(sleepTimer);
      audio.pause();
      stopFrequency();
      playerMode = nextMode;
      sleepMode = "off";
      sleepSelect.value = "off";
      syncModeUI();
      setPlayingUI(false);
      setStatus("ready when you are");
      syncPlayerClearance();
      persistPlayerSession();
    };

    const openPlayer = () => {
      player.hidden = false;
      player.classList.remove("is-minimized");
      playerToggle.setAttribute("aria-expanded", "true");
      playerToggle.setAttribute("title", "Minimize focus audio");
      syncModeUI();
      if (loadedIndex < 0 && !frequencyGenerator?.playing)
        setStatus("ready when you are");
      syncPlayerClearance();
      persistPlayerSession();
    };

    const minimizePlayer = () => {
      player.hidden = false;
      player.classList.add("is-minimized");
      playerToggle.setAttribute("aria-expanded", "false");
      playerToggle.setAttribute("title", "Expand focus audio");
      syncPlayerClearance();
      persistPlayerSession();
    };

    const stopAndClosePlayer = () => {
      window.clearTimeout(sleepTimer);
      sleepMode = "off";
      sleepSelect.value = "off";
      audio.pause();
      frequencyGenerator?.destroy();
      audio.removeAttribute("src");
      audio.load();
      loadedIndex = -1;
      pendingStartTime = 0;
      player.hidden = true;
      player.classList.remove("is-minimized");
      setPlayingUI(false);
      playerToggle.setAttribute("aria-expanded", "false");
      playerToggle.setAttribute("title", "Open focus audio");
      syncPlayerClearance();
      sessionStorage.removeItem(playerSessionKey);
      if ("mediaSession" in navigator)
        navigator.mediaSession.playbackState = "none";
      playerToggle.focus({ preventScroll: true });
    };

    const togglePlayback = () => {
      if (playerMode === "frequency") {
        if (frequencyGenerator?.playing) {
          stopFrequency();
          setStatus("paused");
          persistPlayerSession();
        } else {
          startFrequency();
        }
        return;
      }
      if (loadedIndex < 0) {
        loadEpisode(episodeIndex, true);
        return;
      }
      if (audio.paused) {
        setStatus("connecting to stream…");
        audio
          .play()
          .catch(() => setStatus("stream unavailable — try another episode"));
      } else {
        audio.pause();
      }
    };

    const changeEpisode = (offset) =>
      loadEpisode(episodeIndex + offset, !audio.paused);

    const changeMood = (offset) => {
      const index = frequencyMoodKeys.indexOf(moodKey);
      moodKey =
        frequencyMoodKeys[
          (index + offset + frequencyMoodKeys.length) % frequencyMoodKeys.length
        ];
      syncFrequencyUI();
      if (frequencyGenerator?.playing) startFrequency();
    };

    const changeVariation = (offset) => {
      const index = frequencyVariationKeys.indexOf(variationKey);
      variationKey =
        frequencyVariationKeys[
          (index + offset + frequencyVariationKeys.length) %
            frequencyVariationKeys.length
        ];
      syncFrequencyUI();
      if (frequencyGenerator?.playing) startFrequency();
    };

    playerToggle.addEventListener("click", (event) => {
      if (player.hidden || player.classList.contains("is-minimized")) {
        openPlayer();
        if (event.detail === 0)
          player
            .querySelector("[data-player-play]")
            ?.focus({ preventScroll: true });
      } else {
        minimizePlayer();
      }
    });
    player
      .querySelectorAll("[data-player-minimize]")
      .forEach((button) => button.addEventListener("click", minimizePlayer));
    player
      .querySelectorAll("[data-player-expand]")
      .forEach((button) => button.addEventListener("click", openPlayer));
    player
      .querySelectorAll("[data-player-close]")
      .forEach((button) =>
        button.addEventListener("click", stopAndClosePlayer),
      );
    playButtons.forEach((button) =>
      button.addEventListener("click", togglePlayback),
    );
    player
      .querySelectorAll("[data-player-prev]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          playerMode === "frequency" ? changeMood(-1) : changeEpisode(-1),
        ),
      );
    player
      .querySelectorAll("[data-player-next]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          playerMode === "frequency" ? changeMood(1) : changeEpisode(1),
        ),
      );
    player
      .querySelector("[data-player-rewind]")
      .addEventListener("click", () => {
        if (playerMode === "frequency") changeVariation(-1);
        else audio.currentTime = Math.max(0, audio.currentTime - 30);
      });
    player
      .querySelector("[data-player-forward]")
      .addEventListener("click", () => {
        if (playerMode === "frequency") {
          changeVariation(1);
          return;
        }
        audio.currentTime = Math.min(
          audio.duration || episodes[episodeIndex].duration,
          audio.currentTime + 30,
        );
      });

    modeButtons.forEach((button) => {
      button.addEventListener("click", () =>
        setPlayerMode(button.dataset.playerModeChoice),
      );
    });
    moodSelect.addEventListener("change", () => {
      moodKey = moodSelect.value;
      syncFrequencyUI();
      if (frequencyGenerator?.playing) startFrequency();
      persistPlayerSession();
    });

    variationSelect.addEventListener("change", () => {
      variationKey = variationSelect.value;
      syncFrequencyUI();
      if (frequencyGenerator?.playing) startFrequency();
      persistPlayerSession();
    });

    episodeSelect.addEventListener("change", () =>
      loadEpisode(Number(episodeSelect.value), !audio.paused),
    );
    progress.addEventListener("input", () => {
      const duration = audio.duration || episodes[episodeIndex].duration;
      if (Number.isFinite(duration)) {
        audio.currentTime = (Number(progress.value) / 1000) * duration;
        progress.setAttribute(
          "aria-valuetext",
          `${formatTime(audio.currentTime)} of ${formatTime(duration)}`,
        );
      }
    });

    const storedVolume = Number.parseFloat(
      localStorage.getItem("focus-volume") || "0.8",
    );
    audio.volume = Number.isFinite(storedVolume)
      ? Math.min(1, Math.max(0, storedVolume))
      : 0.8;
    volume.value = String(audio.volume);
    frequencyGenerator?.setVolume(audio.volume);
    volume.addEventListener("input", () => {
      audio.volume = Number(volume.value);
      frequencyGenerator?.setVolume(audio.volume);
      localStorage.setItem("focus-volume", String(audio.volume));
    });

    sleepSelect.addEventListener("change", () => {
      window.clearTimeout(sleepTimer);
      sleepMode = sleepSelect.value;
      const minutes = Number(sleepMode);
      if (Number.isFinite(minutes) && minutes > 0) {
        sleepTimer = window.setTimeout(
          () => {
            if (playerMode === "frequency") stopFrequency();
            else audio.pause();
            sleepMode = "off";
            sleepSelect.value = "off";
            setStatus("sleep timer complete · paused");
            persistPlayerSession();
          },
          minutes * 60 * 1000,
        );
        setStatus(`sleep timer · ${minutes} min`);
      } else if (sleepMode === "episode") {
        setStatus("sleep timer · end of episode");
      } else {
        const playing =
          playerMode === "frequency"
            ? frequencyGenerator?.playing
            : !audio.paused;
        setStatus(
          playing
            ? playerMode === "frequency"
              ? "signal generated locally · use headphones"
              : "signal locked · streaming"
            : "paused",
        );
      }
    });

    audio.addEventListener("playing", () => {
      if (playerMode !== "radio") return;
      setPlayingUI(true);
      setStatus("signal locked · streaming");
      if ("mediaSession" in navigator)
        navigator.mediaSession.playbackState = "playing";
      persistPlayerSession();
    });

    audio.addEventListener("pause", () => {
      if (playerMode !== "radio") return;
      setPlayingUI(false);
      if (audio.currentTime > 0 && !audio.ended) setStatus("paused");
      if ("mediaSession" in navigator)
        navigator.mediaSession.playbackState = "paused";
      persistPlayerSession();
    });

    audio.addEventListener("waiting", () => {
      if (playerMode === "radio") setStatus("buffering…");
    });
    audio.addEventListener("error", () => {
      if (playerMode === "radio" && audio.getAttribute("src"))
        setStatus("stream unavailable — try another episode");
    });
    audio.addEventListener("ended", () => {
      if (sleepMode === "episode") {
        sleepMode = "off";
        sleepSelect.value = "off";
        setStatus("sleep timer complete");
        persistPlayerSession();
      } else {
        changeEpisode(1);
      }
    });
    audio.addEventListener("loadedmetadata", () => {
      if (playerMode !== "radio") return;
      if (pendingStartTime > 0) {
        const duration = audio.duration || episodes[episodeIndex].duration;
        audio.currentTime = Math.min(
          pendingStartTime,
          Math.max(0, duration - 1),
        );
        pendingStartTime = 0;
      }
      durationNode.textContent = formatTime(
        audio.duration || episodes[episodeIndex].duration,
      );
      if (audio.paused) setStatus("ready when you are");
    });
    audio.addEventListener("timeupdate", () => {
      if (playerMode !== "radio") return;
      const duration = audio.duration || episodes[episodeIndex].duration;
      currentTimeNode.textContent = formatTime(audio.currentTime);
      progress.value =
        Number.isFinite(duration) && duration > 0
          ? String(Math.round((audio.currentTime / duration) * 1000))
          : "0";
      player.style.setProperty(
        "--player-progress",
        `${Number(progress.value) / 10}%`,
      );
      progress.setAttribute(
        "aria-valuetext",
        `${formatTime(audio.currentTime)} of ${formatTime(duration)}`,
      );
      if (
        "mediaSession" in navigator &&
        Number.isFinite(duration) &&
        duration > 0 &&
        audio.currentTime <= duration
      ) {
        try {
          navigator.mediaSession.setPositionState({
            duration,
            playbackRate: audio.playbackRate,
            position: audio.currentTime,
          });
        } catch {
          // Some streaming responses expose incomplete duration metadata.
        }
      }
    });

    window.addEventListener("pagehide", persistPlayerSession);

    player.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || player.classList.contains("is-minimized"))
        return;
      event.preventDefault();
      minimizePlayer();
      playerToggle.focus({ preventScroll: true });
    });

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => {
        if (playerMode === "frequency") startFrequency();
        else if (loadedIndex < 0) loadEpisode(episodeIndex, true);
        else audio.play().catch(() => setStatus("tap play to continue"));
      });
      navigator.mediaSession.setActionHandler("pause", () =>
        playerMode === "frequency" ? stopFrequency() : audio.pause(),
      );
      navigator.mediaSession.setActionHandler("previoustrack", () =>
        playerMode === "frequency" ? changeMood(-1) : changeEpisode(-1),
      );
      navigator.mediaSession.setActionHandler("nexttrack", () =>
        playerMode === "frequency" ? changeMood(1) : changeEpisode(1),
      );
      navigator.mediaSession.setActionHandler("seekbackward", () => {
        if (playerMode !== "radio") return;
        audio.currentTime = Math.max(0, audio.currentTime - 30);
      });
      navigator.mediaSession.setActionHandler("seekforward", () => {
        if (playerMode !== "radio") return;
        audio.currentTime = Math.min(
          audio.duration || episodes[episodeIndex].duration,
          audio.currentTime + 30,
        );
      });
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (playerMode !== "radio") return;
        if (Number.isFinite(details.seekTime)) {
          audio.currentTime = details.seekTime;
        }
      });
      navigator.mediaSession.setActionHandler("stop", stopAndClosePlayer);
    }

    syncModeUI();
    setPlayingUI(false);
    playerToggle.setAttribute("title", "Open focus audio");
    const focusRequest = new URLSearchParams(window.location.search).get(
      "focus",
    );
    const focusRequested = focusRequest !== null;
    const shouldRestore =
      restoredSession &&
      ["expanded", "minimized", "hidden"].includes(restoredSession.view) &&
      (playerMode === "frequency" || episodes[restoredSession.episodeIndex]);

    if (shouldRestore) {
      if (focusRequest === "mini") minimizePlayer();
      else if (focusRequested || restoredSession.view === "expanded")
        openPlayer();
      else minimizePlayer();
      if (playerMode === "frequency") {
        if (restoredSession.playing)
          setStatus("tap play to resume frequencies");
      } else {
        loadEpisode(
          Number(restoredSession.episodeIndex),
          Boolean(restoredSession.playing),
          Number(restoredSession.currentTime) || 0,
        );
      }
    } else if (focusRequested) {
      if (focusRequest === "mini") minimizePlayer();
      else openPlayer();
    }
  }

  const serviceWorkerURL = document.currentScript?.dataset.serviceWorker;
  if (serviceWorkerURL && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(serviceWorkerURL).catch(() => {
        // Matrix still works online when private browsing blocks registration.
      });
    });
  }
})();
