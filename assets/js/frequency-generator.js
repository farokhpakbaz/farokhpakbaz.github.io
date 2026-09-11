(() => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  class FocusFrequencyGenerator {
    constructor() {
      this.context = null;
      this.master = null;
      this.activeSession = null;
      this.volume = 0.8;
    }

    get supported() {
      return Boolean(AudioContextClass);
    }

    get playing() {
      return Boolean(this.activeSession);
    }

    async ensureContext() {
      if (!this.supported) throw new Error("Web Audio is unavailable");
      if (!this.context || this.context.state === "closed") {
        this.context = new AudioContextClass();
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 18;
        compressor.ratio.value = 5;
        compressor.attack.value = 0.08;
        compressor.release.value = 0.5;
        this.master = this.context.createGain();
        this.master.gain.value = this.outputLevel();
        this.master.connect(compressor);
        compressor.connect(this.context.destination);
      }
      await this.context.resume();
      return this.context;
    }

    outputLevel() {
      return Math.pow(this.volume, 1.35) * 0.3;
    }

    setVolume(value) {
      this.volume = Math.min(1, Math.max(0, Number(value) || 0));
      if (!this.context || !this.master) return;
      this.master.gain.setTargetAtTime(
        this.outputLevel(),
        this.context.currentTime,
        0.04,
      );
    }

    createOscillator(session, frequency, type, gainValue, pan = 0) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.value = gainValue;
      oscillator.connect(gain);

      if (typeof this.context.createStereoPanner === "function") {
        const panner = this.context.createStereoPanner();
        panner.pan.value = pan;
        gain.connect(panner);
        panner.connect(session.input);
      } else {
        gain.connect(session.input);
      }

      oscillator.start();
      session.sources.push(oscillator);
      return { oscillator, gain };
    }

    createBrownNoise(session, amount, cutoff) {
      if (amount <= 0) return;
      const sampleCount = Math.floor(this.context.sampleRate * 2);
      const buffer = this.context.createBuffer(
        1,
        sampleCount,
        this.context.sampleRate,
      );
      const samples = buffer.getChannelData(0);
      let last = 0;
      for (let index = 0; index < samples.length; index += 1) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.018 * white) / 1.018;
        samples[index] = last * 3.2;
      }

      const source = this.context.createBufferSource();
      const filter = this.context.createBiquadFilter();
      const gain = this.context.createGain();
      source.buffer = buffer;
      source.loop = true;
      filter.type = "lowpass";
      filter.frequency.value = cutoff;
      filter.Q.value = 0.35;
      gain.gain.value = amount;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(session.input);
      source.start();
      session.sources.push(source);
    }

    async start(mood, variation) {
      await this.ensureContext();
      this.stop();

      const now = this.context.currentTime;
      const input = this.context.createGain();
      const session = { input, sources: [] };
      input.gain.setValueAtTime(0.0001, now);
      input.gain.exponentialRampToValueAtTime(1, now + 0.8);
      input.connect(this.master);
      this.activeSession = session;

      const carrier = mood.carrier;
      this.createOscillator(
        session,
        carrier,
        "sine",
        0.19,
        -0.82,
      );
      this.createOscillator(
        session,
        carrier + mood.beat,
        "sine",
        0.19,
        0.82,
      );

      const pad = this.createOscillator(
        session,
        carrier * variation.harmonicRatio,
        variation.wave,
        variation.harmonic,
        0,
      );
      const lfo = this.context.createOscillator();
      const lfoDepth = this.context.createGain();
      lfo.frequency.value = variation.motion;
      lfoDepth.gain.value = variation.harmonic * variation.motionDepth;
      lfo.connect(lfoDepth);
      lfoDepth.connect(pad.gain.gain);
      lfo.start();
      session.sources.push(lfo);

      this.createBrownNoise(session, variation.noise, variation.noiseCutoff);
      return true;
    }

    stop() {
      const session = this.activeSession;
      if (!session || !this.context) return;
      this.activeSession = null;
      const context = this.context;
      const now = context.currentTime;
      session.input.gain.cancelScheduledValues(now);
      session.input.gain.setTargetAtTime(0.0001, now, 0.12);
      session.sources.forEach((source) => {
        try {
          source.stop(now + 0.65);
        } catch {
          // A source may already have stopped during rapid preset changes.
        }
      });
      window.setTimeout(() => {
        session.input.disconnect();
        if (
          !this.activeSession &&
          this.context === context &&
          context.state === "running"
        ) {
          context.suspend().catch(() => {});
        }
      }, 800);
    }

    async destroy() {
      this.stop();
      if (!this.context) return;
      const context = this.context;
      this.context = null;
      this.master = null;
      window.setTimeout(() => context.close().catch(() => {}), 800);
    }
  }

  window.FocusFrequencyGenerator = FocusFrequencyGenerator;
})();
