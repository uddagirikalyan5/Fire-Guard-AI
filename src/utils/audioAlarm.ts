class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private oscillator1: OscillatorNode | null = null;
  private oscillator2: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isAlarmPlaying = false;
  private sirenInterval: number | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playAlarm(volumePercent: number = 80) {
    if (this.isAlarmPlaying) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      this.isAlarmPlaying = true;
      const vol = Math.max(0.01, Math.min(1, volumePercent / 100)) * 0.3; // safe gain level

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(vol, this.ctx.currentTime);
      this.gainNode.connect(this.ctx.destination);

      this.oscillator1 = this.ctx.createOscillator();
      this.oscillator1.type = 'sawtooth';
      this.oscillator1.frequency.setValueAtTime(800, this.ctx.currentTime);
      this.oscillator1.connect(this.gainNode);
      this.oscillator1.start();

      let high = false;
      this.sirenInterval = window.setInterval(() => {
        if (!this.oscillator1 || !this.ctx) return;
        const now = this.ctx.currentTime;
        const targetFreq = high ? 960 : 640;
        this.oscillator1.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.3);
        high = !high;
      }, 350);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  public stopAlarm() {
    if (!this.isAlarmPlaying) return;
    this.isAlarmPlaying = false;
    if (this.sirenInterval) {
      clearInterval(this.sirenInterval);
      this.sirenInterval = null;
    }
    try {
      if (this.oscillator1) {
        this.oscillator1.stop();
        this.oscillator1.disconnect();
        this.oscillator1 = null;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
    } catch (e) {
      console.warn('Audio stop error:', e);
    }
  }

  public playBeep(freq: number = 1200, duration: number = 0.1) {
    try {
      this.initContext();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio context might be restricted before interaction
    }
  }
}

export const soundAlarm = new SoundSynthesizer();
