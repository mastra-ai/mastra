// @vitest-environment jsdom
import assert from 'node:assert';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadDoneSound, playDoneSound, saveDoneSound } from './doneSound';

interface FakeBuffer {
  numberOfChannels: number;
  channels: Float32Array[];
  getChannelData: (index: number) => Float32Array;
}

interface FakeConvolver {
  normalize: boolean;
  buffer: FakeBuffer | null;
  connect: () => void;
}

interface FakeParam {
  value: number;
  setValueAtTime: () => void;
  exponentialRampToValueAtTime: () => void;
}

const SAMPLE_RATE = 8000;

function installFakeAudio() {
  const convolvers: FakeConvolver[] = [];
  const gains: FakeParam[] = [];
  const param = (): FakeParam => ({ value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} });

  class FakeAudioContext {
    sampleRate = SAMPLE_RATE;
    currentTime = 0;
    state = 'running';
    destination = {};
    createBuffer(channelCount: number, length: number): FakeBuffer {
      const channels = Array.from({ length: channelCount }, () => new Float32Array(length));
      return { numberOfChannels: channelCount, channels, getChannelData: index => channels[index] };
    }
    createConvolver(): FakeConvolver {
      const convolver: FakeConvolver = { normalize: true, buffer: null, connect: () => {} };
      convolvers.push(convolver);
      return convolver;
    }
    createBiquadFilter() {
      return { type: '', frequency: param(), Q: param(), gain: param(), connect: () => {} };
    }
    createWaveShaper() {
      return { curve: new Float32Array(), oversample: 'none', connect: () => {} };
    }
    createGain() {
      const gain = param();
      gains.push(gain);
      return { gain, connect: () => {} };
    }
    createOscillator() {
      return { type: '', frequency: param(), connect: () => {}, start: () => {}, stop: () => {} };
    }
  }

  Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext, configurable: true });
  return { convolvers, gainValues: () => gains.map(gain => gain.value) };
}

async function playFresh(sound: 'chime' | 'arcade') {
  const audio = installFakeAudio();
  vi.resetModules();
  const module = await import('./doneSound');
  module.playDoneSound(sound);
  return audio;
}

function peakOf(channels: Float32Array[]): number {
  return channels.reduce(
    (max, samples) => samples.reduce((running, sample) => Math.max(running, Math.abs(sample)), max),
    0,
  );
}

afterEach(() => {
  localStorage.clear();
  Reflect.deleteProperty(window, 'AudioContext');
});

describe('doneSound', () => {
  it('defaults to the chime when nothing is stored', () => {
    expect(loadDoneSound()).toBe('chime');
  });

  it('round-trips a saved preference', () => {
    saveDoneSound('fanfare');
    expect(loadDoneSound()).toBe('fanfare');
    saveDoneSound('none');
    expect(loadDoneSound()).toBe('none');
  });

  it('ignores unknown stored values', () => {
    localStorage.setItem('mastracode.doneSound', 'airhorn');
    expect(loadDoneSound()).toBe('chime');
  });

  it('never throws when audio is unavailable', () => {
    // jsdom has no AudioContext; playback must stay a silent no-op.
    expect(() => playDoneSound('chime')).not.toThrow();
    expect(() => playDoneSound('arcade')).not.toThrow();
    expect(() => playDoneSound('fanfare')).not.toThrow();
    expect(() => playDoneSound('none')).not.toThrow();
  });

  it('builds the tail chain once, not per playback', async () => {
    const audio = installFakeAudio();
    vi.resetModules();
    const module = await import('./doneSound');
    module.playDoneSound('chime');
    module.playDoneSound('chime');
    expect(audio.convolvers).toHaveLength(1);
  });

  it('leaves the arcade blip dry', async () => {
    const audio = await playFresh('arcade');
    expect(audio.convolvers).toEqual([]);
  });

  it('gives the chime a seeded, peak-normalized tail the convolver will not rescale', async () => {
    const first = await playFresh('chime');
    const second = await playFresh('chime');

    const [convolver] = first.convolvers;
    assert(convolver?.buffer);
    assert(second.convolvers[0]?.buffer);

    // Left on, the convolver applies its own ~31 dB of gain and the wet level
    // stops matching the reference render.
    expect(convolver.normalize).toBe(false);
    expect(convolver.buffer.channels[0]).toHaveLength(SAMPLE_RATE * 2.2);
    expect(peakOf(convolver.buffer.channels)).toBeCloseTo(1, 6);
    // A fresh Math.random() draw per playback would make these differ.
    expect(convolver.buffer.channels).toEqual(second.convolvers[0].buffer.channels);
    expect(first.gainValues()).toContain(0.00195);
    expect(first.gainValues()).toContain(0.6);
  });
});
