import { Emitter } from '../core/events.js';
import { settings } from '../core/settings.js';
import { narrationText } from '../content/repository.js';

// Audioguia. Toca o áudio gravado do item (item.audio.src) quando existir;
// senão, ou se o arquivo não carregar, lê o texto com a voz do aparelho.
//
// Um único elemento <audio> é reaproveitado para todas as narrações: no iOS,
// depois de liberado por um toque (unlock), ele pode tocar sozinho quando um
// cartaz é reconhecido na câmera.
//
// Eventos: 'state' { status: 'playing' | 'paused' | 'stopped', item }
class Narrator extends Emitter {
  constructor() {
    super();
    this.item = null;
    this.status = 'stopped';
    this.audio = null;      // o elemento abaixo, enquanto toca um arquivo
    this.el = typeof Audio !== 'undefined' ? new Audio() : null;
    if (this.el) {
      this.el.preload = 'auto';
      this.el.addEventListener('ended', () => { if (this.audio) this.stop(); });
    }
    this.synth = window.speechSynthesis ?? null;
    this.voice = null;
    this.chunks = [];
    this.chunkIndex = 0;
    if (this.synth) {
      const pick = () => { this.voice = this.#pickVoice(); };
      pick();
      this.synth.addEventListener?.('voiceschanged', pick);
    }
    // O primeiro toque em qualquer lugar do app já libera o áudio.
    document.addEventListener('pointerdown', () => this.unlock(), { once: true, capture: true });
  }

  get available() {
    return Boolean(this.synth) || typeof Audio !== 'undefined';
  }

  // No iOS a voz só toca depois de um toque do visitante. Chame isto dentro de
  // um clique (ex.: botão "Iniciar audioguia") para liberar a reprodução automática.
  unlock() {
    if (this.el && !this.audio && !this.unlocked) {
      this.unlocked = true;
      this.el.src = SILENCE;
      this.el.play().catch(() => {});
    }
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
      this.audio.removeAttribute('src');
      this.audio.load();
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
    if (!this.el) return this.#speak(narrationText(this.item));
    const item = this.item;
    this.audio = this.el;
    this.audio.src = src;
    this.#set('playing');
    this.audio.play().catch((err) => {
      if (this.item !== item) return; // outra narração começou
      this.audio = null;
      if (err?.name === 'NotAllowedError') return this.stop(); // falta um toque do visitante
      this.#speak(narrationText(item)); // arquivo indisponível: usa a voz do aparelho
    });
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

// Um WAV vazio, tocado no primeiro toque só para liberar o áudio.
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

export const narrator = new Narrator();
