import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/voice-property-names';
import { testTransform, applyTransform } from './test-utils';

describe('voice-property-names', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'voice-property-names');
  });

  it('does not transform voice properties outside Agent config', () => {
    const input = `
// Some other config object, not from new Agent()
const config = {
  voice: {
    speakProvider: murfVoice,
    listenProvider: deepgramVoice,
    realtimeProvider: openaiRealtime,
  },
};

// Should not be transformed
const voiceConfig = {
  speakProvider: 'test',
  listenProvider: 'test',
  realtimeProvider: 'test',
};
`;

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
