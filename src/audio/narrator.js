import { Emitter } from '../core/events.js';
import { settings } from '../core/settings.js';
import { narrationText } from '../content/repository.js';

// Audioguia. Toca o áudio gravado do item (item.audio.src) quando existir;
// senão, lê o texto do item com a voz do aparelho (funciona sem internet).
//
// Eventos: 'state' { status: 'playing' | 'paused' | 'stopped', item }
class Narrator extends Emitter {
  constructor() {
    super();
    this.item = null;
    this.status = 'stopped';
    this.audio = null;
    this.synth = window.speechSynthesis ?? null;
    this.voice = null;
    this.chunks = [];
    this.chunkIndex = 0;
    if (this.synth) {
      const pick = () => { this.voice = this.#pickVoice(); };
      pick();
      this.synth.addEventListener?.('voiceschanged', pick);
    }
  }

  get available() {
    return Boolean(this.synth) || typeof Audio !== 'undefined';
  }

  // No iOS a voz só toca depois de um toque do visitante. Chame isto dentro de
  // um clique (ex.: botão "Iniciar audioguia") para liberar a reprodução automática.
  unlock() {
    if (!this.synth) return;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    this.synth.speak(u);
  }

  play(item) {
    if (!settings.get('audio')) return;
    if (this.item?.id === item.id && this.status === 'paused') return this.resume();
    this.stop();
    this.item = item;
    if (item.audio?.src) this.#playFile(item.audio.src);
    else this.#speak(narrationText(item));
  }

  toggle(item) {
    if (this.item?.id === item.id && this.status === 'playing') this.pause();
    else this.play(item);
  }

  pause() {
    if (this.status !== 'playing') return;
    if (this.audio) this.audio.pause();
    else this.synth?.pause();
    this.#set('paused');
  }

  resume() {
    if (this.status !== 'paused') return;
    if (this.audio) this.audio.play();
    else this.synth?.resume();
    this.#set('playing');
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    if (this.synth) {
      this.chunks = [];
      this.synth.cancel();
    }
    if (this.status !== 'stopped') this.#set('stopped');
    this.item = null;
  }

  isPlaying(item) {
    return this.item?.id === item.id && this.status === 'playing';
  }

  #playFile(src) {
    this.audio = new Audio(src);
    this.audio.addEventListener('ended', () => this.stop());
    this.audio.play().then(() => this.#set('playing')).catch(() => this.stop());
  }

  #speak(text) {
    if (!this.synth) return;
    // Frases curtas: alguns navegadores cortam falas longas no meio.
    this.chunks = text.match(/[^.!?…]+[.!?…]*["”]?\s*/g) ?? [text];
    this.chunkIndex = 0;
    this.#set('playing');
    this.#speakNext();
  }

  #speakNext() {
    if (this.chunkIndex >= this.chunks.length) {
      this.stop();
      return;
    }
    const u = new SpeechSynthesisUtterance(this.chunks[this.chunkIndex].trim());
    u.lang = 'pt-BR';
    if (this.voice) u.voice = this.voice;
    u.rate = 1;
    const current = this.chunks;
    u.onend = () => {
      if (this.chunks !== current) return; // outra narração começou
      this.chunkIndex += 1;
      this.#speakNext();
    };
    this.synth.speak(u);
  }

  #pickVoice() {
    const voices = this.synth.getVoices();
    const pt = voices.filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('pt'));
    return (
      pt.find((v) => /pt-br/i.test(v.lang.replace('_', '-')) && v.localService) ??
      pt.find((v) => /pt-br/i.test(v.lang.replace('_', '-'))) ??
      pt[0] ??
      null
    );
  }

  #set(status) {
    this.status = status;
    this.emit('state', { status, item: this.item });
  }
}

export const narrator = new Narrator();
