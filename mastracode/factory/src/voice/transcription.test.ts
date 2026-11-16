import { describe, expect, it } from 'vitest';

import { audioFiletype } from './transcription.js';

describe('audioFiletype', () => {
  it.each([
    ['audio/webm;codecs=opus', 'webm'],
    ['video/webm', 'webm'],
    ['audio/mp4', 'm4a'],
    ['video/mp4', 'mp4'],
    ['audio/mpeg', 'mp3'],
    ['audio/wav', 'wav'],
    ['audio/ogg;codecs=opus', 'ogg'],
    ['application/octet-stream', 'webm'],
  ])('maps %s to %s', (mimeType, expected) => {
    expect(audioFiletype(mimeType)).toBe(expected);
  });
});
