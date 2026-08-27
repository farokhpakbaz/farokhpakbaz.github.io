(() => {
  const root = document.documentElement;
  const toggle = document.querySelector(".theme-toggle");
  const storedTheme = localStorage.getItem("theme");
  const preferredTheme = window.matchMedia("(prefers-color-scheme: light)")
    .matches
    ? "light"
    : "dark";

  const setTheme = (theme) => {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    toggle?.setAttribute(
      "aria-label",
      `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
    );
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0a0c0b" : "#eceee8");
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
  const matrixSettingsToggles = [
    ...document.querySelectorAll("[data-matrix-settings-toggle]"),
  ];
  const matrixSettingsToggle = matrixSettingsToggles[0];
  const matrixFullscreen = document.querySelector("[data-matrix-fullscreen]");
  const siteShell = document.querySelector(".site-shell");
  const focusPlayerPanel = document.querySelector("[data-player]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const matrixStorageKey = "matrix-settings-v1";
  let matrixMode = "off";
  let matrixLastMode = "ambient";
  let matrixIdleTimer;
  let matrixReloadTimer;
  let matrixResizeTimer;
  let matrixKeyboardNavigation = false;
  let matrixLastFocus;
  let matrixInstallPrompt;

  const matrixAppDisplay = ["fullscreen", "standalone", "minimal-ui"].some(
    (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
  );

  const syncMatrixInstallButtons = () => {
    matrixInstallButtons.forEach((button) => {
      button.hidden = matrixAppDisplay || !matrixInstallPrompt;
    });
  };

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

  const syncMatrixOutputs = () => {
    const signed = (value) =>
      Number(value).toFixed(2).replace("-", "−");
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
      clamp(
        window.innerHeight / matrixSettings.charSize,
        32,
        160,
        80,
      ),
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
      paletteRGB: [
        0,
        0,
        0,
        0,
        ...dim,
        0.45,
        red,
        green,
        blue,
        1,
      ].join(","),
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
      matrixSettingsPanel?.hidden
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

  toggle?.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    if (next === "light" && matrixMode !== "off") setMatrixMode("off");
    localStorage.setItem("theme", next);
    setTheme(next);
  });

  matrixToggle?.addEventListener("click", () =>
    setMatrixModeMenu(matrixModeMenu?.hidden, matrixKeyboardNavigation),
  );
  document.querySelectorAll("[data-matrix-mode-choice]").forEach((choice) =>
    choice.addEventListener("click", () =>
      setMatrixMode(choice.dataset.matrixModeChoice),
    ),
  );
  matrixUI?.querySelectorAll("[data-matrix-close]").forEach((button) =>
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
        ].includes(setting)
      ) {
        matrixSettings.preset = "custom";
        matrixControl("preset").value = "custom";
      }
    }

    syncMatrixControls();
    saveMatrixSettings();
    loadMatrix();
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
      else setMatrixMode("off");
      return;
    }
    if (!isFormControl && event.key.toLowerCase() === "m") {
      event.preventDefault();
      setMatrixMode("off");
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
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

  document.addEventListener("pointerdown", (event) => {
    if (!matrixLauncher?.contains(event.target)) setMatrixModeMenu(false);
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

  const player = document.querySelector("[data-player]");
  const audio = player?.querySelector("[data-player-audio]");
  const playerToggle = document.querySelector("[data-player-toggle]");

  if (player && audio && playerToggle && episodes.length) {
    const titleNode = player.querySelector("[data-player-title]");
    const miniTitleNode = player.querySelector("[data-player-mini-title]");
    const statusNode = player.querySelector("[data-player-status]");
    const playIcons = [...player.querySelectorAll("[data-play-icon]")];
    const playButtons = [...player.querySelectorAll("[data-player-play]")];
    const episodeSelect = player.querySelector("[data-episode-select]");
    const progress = player.querySelector("[data-player-progress]");
    const currentTimeNode = player.querySelector("[data-current-time]");
    const durationNode = player.querySelector("[data-duration]");
    const volume = player.querySelector("[data-player-volume]");
    const sleepSelect = player.querySelector("[data-player-sleep]");
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
    episodeSelect.value = String(episodeIndex);

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

    const syncEpisodeUI = () => {
      const episode = episodes[episodeIndex];
      titleNode.textContent = episode.title;
      if (miniTitleNode) miniTitleNode.textContent = episode.title;
      durationNode.textContent = formatTime(episode.duration);
      episodeSelect.value = String(episodeIndex);
      localStorage.setItem("focus-episode", String(episodeIndex));

      if ("mediaSession" in navigator && "MediaMetadata" in window) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: episode.title,
          artist: "Music For Programming",
          album: "musicforprogramming.net",
        });
      }
    };

    const persistPlayerSession = () => {
      if (player.hidden && loadedIndex < 0) return;
      sessionStorage.setItem(
        playerSessionKey,
        JSON.stringify({
          episodeIndex,
          currentTime: Number.isFinite(audio.currentTime)
            ? audio.currentTime
            : 0,
          playing: !audio.paused,
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

    const openPlayer = () => {
      player.hidden = false;
      player.classList.remove("is-minimized");
      playerToggle.setAttribute("aria-expanded", "true");
      playerToggle.setAttribute("title", "Minimize focus radio");
      if (loadedIndex < 0) {
        syncEpisodeUI();
        setStatus("ready when you are");
      }
      syncPlayerClearance();
      persistPlayerSession();
    };

    const minimizePlayer = () => {
      player.hidden = false;
      player.classList.add("is-minimized");
      playerToggle.setAttribute("aria-expanded", "false");
      playerToggle.setAttribute("title", "Expand focus radio");
      syncPlayerClearance();
      persistPlayerSession();
    };

    const stopAndClosePlayer = () => {
      window.clearTimeout(sleepTimer);
      sleepMode = "off";
      sleepSelect.value = "off";
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      loadedIndex = -1;
      pendingStartTime = 0;
      player.hidden = true;
      player.classList.remove("is-minimized", "is-playing");
      playerToggle.classList.remove("is-playing");
      playerToggle.setAttribute("aria-expanded", "false");
      playerToggle.setAttribute("title", "Open focus radio");
      syncPlayerClearance();
      sessionStorage.removeItem(playerSessionKey);
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none";
      playerToggle.focus({ preventScroll: true });
    };

    const togglePlayback = () => {
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

    playerToggle.addEventListener("click", () => {
      if (player.hidden || player.classList.contains("is-minimized")) {
        openPlayer();
      } else {
        minimizePlayer();
      }
    });
    player.querySelectorAll("[data-player-minimize]").forEach((button) =>
      button.addEventListener("click", minimizePlayer),
    );
    player.querySelectorAll("[data-player-expand]").forEach((button) =>
      button.addEventListener("click", openPlayer),
    );
    player.querySelectorAll("[data-player-close]").forEach((button) =>
      button.addEventListener("click", stopAndClosePlayer),
    );
    playButtons.forEach((button) =>
      button.addEventListener("click", togglePlayback),
    );
    player.querySelectorAll("[data-player-prev]").forEach((button) =>
      button.addEventListener("click", () => changeEpisode(-1)),
    );
    player.querySelectorAll("[data-player-next]").forEach((button) =>
      button.addEventListener("click", () => changeEpisode(1)),
    );
    player
      .querySelector("[data-player-rewind]")
      .addEventListener("click", () => {
        audio.currentTime = Math.max(0, audio.currentTime - 30);
      });
    player
      .querySelector("[data-player-forward]")
      .addEventListener("click", () => {
        audio.currentTime = Math.min(
          audio.duration || episodes[episodeIndex].duration,
          audio.currentTime + 30,
        );
      });

    episodeSelect.addEventListener("change", () =>
      loadEpisode(Number(episodeSelect.value), !audio.paused),
    );
    progress.addEventListener("input", () => {
      const duration = audio.duration || episodes[episodeIndex].duration;
      if (Number.isFinite(duration))
        audio.currentTime = (Number(progress.value) / 1000) * duration;
    });

    const storedVolume = Number.parseFloat(
      localStorage.getItem("focus-volume") || "0.8",
    );
    audio.volume = Number.isFinite(storedVolume)
      ? Math.min(1, Math.max(0, storedVolume))
      : 0.8;
    volume.value = String(audio.volume);
    volume.addEventListener("input", () => {
      audio.volume = Number(volume.value);
      localStorage.setItem("focus-volume", String(audio.volume));
    });

    sleepSelect.addEventListener("change", () => {
      window.clearTimeout(sleepTimer);
      sleepMode = sleepSelect.value;
      const minutes = Number(sleepMode);
      if (Number.isFinite(minutes) && minutes > 0) {
        sleepTimer = window.setTimeout(() => {
          audio.pause();
          sleepMode = "off";
          sleepSelect.value = "off";
          setStatus("sleep timer complete · paused");
          persistPlayerSession();
        }, minutes * 60 * 1000);
        setStatus(`sleep timer · ${minutes} min`);
      } else if (sleepMode === "episode") {
        setStatus("sleep timer · end of episode");
      } else {
        setStatus(audio.paused ? "paused" : "signal locked · streaming");
      }
    });

    audio.addEventListener("playing", () => {
      player.classList.add("is-playing");
      playerToggle.classList.add("is-playing");
      playIcons.forEach((icon) => {
        icon.textContent = icon.closest(".player-mini") ? "Ⅱ" : "PAUSE";
      });
      playButtons.forEach((button) =>
        button.setAttribute("aria-label", "Pause"),
      );
      setStatus("signal locked · streaming");
      if ("mediaSession" in navigator)
        navigator.mediaSession.playbackState = "playing";
      persistPlayerSession();
    });

    audio.addEventListener("pause", () => {
      player.classList.remove("is-playing");
      playerToggle.classList.remove("is-playing");
      playIcons.forEach((icon) => {
        icon.textContent = icon.closest(".player-mini") ? "▶" : "PLAY";
      });
      playButtons.forEach((button) =>
        button.setAttribute("aria-label", "Play"),
      );
      if (audio.currentTime > 0 && !audio.ended) setStatus("paused");
      if ("mediaSession" in navigator)
        navigator.mediaSession.playbackState = "paused";
      persistPlayerSession();
    });

    audio.addEventListener("waiting", () => setStatus("buffering…"));
    audio.addEventListener("error", () => {
      if (audio.getAttribute("src"))
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
      if (pendingStartTime > 0) {
        const duration = audio.duration || episodes[episodeIndex].duration;
        audio.currentTime = Math.min(pendingStartTime, Math.max(0, duration - 1));
        pendingStartTime = 0;
      }
      durationNode.textContent = formatTime(
        audio.duration || episodes[episodeIndex].duration,
      );
      if (audio.paused) setStatus("ready when you are");
    });
    audio.addEventListener("timeupdate", () => {
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

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => {
        if (loadedIndex < 0) loadEpisode(episodeIndex, true);
        else audio.play().catch(() => setStatus("tap play to continue"));
      });
      navigator.mediaSession.setActionHandler("pause", () => audio.pause());
      navigator.mediaSession.setActionHandler("previoustrack", () =>
        changeEpisode(-1),
      );
      navigator.mediaSession.setActionHandler("nexttrack", () =>
        changeEpisode(1),
      );
      navigator.mediaSession.setActionHandler("seekbackward", () => {
        audio.currentTime = Math.max(0, audio.currentTime - 30);
      });
      navigator.mediaSession.setActionHandler("seekforward", () => {
        audio.currentTime = Math.min(
          audio.duration || episodes[episodeIndex].duration,
          audio.currentTime + 30,
        );
      });
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (Number.isFinite(details.seekTime)) {
          audio.currentTime = details.seekTime;
        }
      });
      navigator.mediaSession.setActionHandler("stop", stopAndClosePlayer);
    }

    syncEpisodeUI();
    playerToggle.setAttribute("title", "Open focus radio");
    const focusRequest = new URLSearchParams(window.location.search).get(
      "focus",
    );
    const focusRequested = focusRequest !== null;
    const shouldRestore =
      restoredSession &&
      episodes[restoredSession.episodeIndex] &&
      ["expanded", "minimized", "hidden"].includes(restoredSession.view);

    if (shouldRestore) {
      if (focusRequest === "mini") minimizePlayer();
      else if (focusRequested || restoredSession.view === "expanded")
        openPlayer();
      else minimizePlayer();
      loadEpisode(
        Number(restoredSession.episodeIndex),
        Boolean(restoredSession.playing),
        Number(restoredSession.currentTime) || 0,
      );
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
