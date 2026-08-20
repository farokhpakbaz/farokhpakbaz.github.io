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

  setTheme(storedTheme || preferredTheme);

  toggle?.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    setTheme(next);
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
    const statusNode = player.querySelector("[data-player-status]");
    const playIcon = player.querySelector("[data-play-icon]");
    const playButton = player.querySelector("[data-player-play]");
    const episodeSelect = player.querySelector("[data-episode-select]");
    const progress = player.querySelector("[data-player-progress]");
    const currentTimeNode = player.querySelector("[data-current-time]");
    const durationNode = player.querySelector("[data-duration]");
    const volume = player.querySelector("[data-player-volume]");
    let episodeIndex = Number.parseInt(
      localStorage.getItem("focus-episode") || "0",
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

    const loadEpisode = (index, playAfter = false) => {
      episodeIndex = (index + episodes.length) % episodes.length;
      loadedIndex = episodeIndex;
      audio.src = episodes[episodeIndex].url;
      audio.load();
      progress.value = "0";
      currentTimeNode.textContent = "00:00";
      syncEpisodeUI();
      setStatus("connecting to stream…");
      if (playAfter) audio.play().catch(() => setStatus("press play to start"));
    };

    const openPlayer = () => {
      player.hidden = false;
      playerToggle.setAttribute("aria-expanded", "true");
      if (loadedIndex < 0) {
        syncEpisodeUI();
        setStatus("ready when you are");
      }
    };

    const closePlayer = () => {
      player.hidden = true;
      playerToggle.setAttribute("aria-expanded", "false");
      playerToggle.focus({ preventScroll: true });
    };

    const togglePlayback = () => {
      if (loadedIndex < 0) loadEpisode(episodeIndex);
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

    playerToggle.addEventListener("click", () =>
      player.hidden ? openPlayer() : closePlayer(),
    );
    player
      .querySelector("[data-player-close]")
      .addEventListener("click", closePlayer);
    playButton.addEventListener("click", togglePlayback);
    player
      .querySelector("[data-player-prev]")
      .addEventListener("click", () => changeEpisode(-1));
    player
      .querySelector("[data-player-next]")
      .addEventListener("click", () => changeEpisode(1));
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

    audio.addEventListener("playing", () => {
      player.classList.add("is-playing");
      playerToggle.classList.add("is-playing");
      playIcon.textContent = "PAUSE";
      playButton.setAttribute("aria-label", "Pause");
      setStatus("signal locked · streaming");
    });

    audio.addEventListener("pause", () => {
      player.classList.remove("is-playing");
      playerToggle.classList.remove("is-playing");
      playIcon.textContent = "PLAY";
      playButton.setAttribute("aria-label", "Play");
      if (audio.currentTime > 0 && !audio.ended) setStatus("paused");
    });

    audio.addEventListener("waiting", () => setStatus("buffering…"));
    audio.addEventListener("error", () =>
      setStatus("stream unavailable — try another episode"),
    );
    audio.addEventListener("ended", () => changeEpisode(1));
    audio.addEventListener("loadedmetadata", () => {
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
    });

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", togglePlayback);
      navigator.mediaSession.setActionHandler("pause", togglePlayback);
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
    }

    syncEpisodeUI();
    if (new URLSearchParams(window.location.search).has("focus")) openPlayer();
  }
})();
