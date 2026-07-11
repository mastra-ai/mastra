import { describe, expect, it } from 'vitest';

import { Mastra } from './index';

describe('Mastra tool payload transform policy', () => {
  it('stores transform policies from config', () => {
    const transformToolPayload = () => ({ safe: true });
    const mastra = new Mastra({
      logger: false,
      transform: {
        targets: ['display'],
        transformToolPayload,
      },
    });

    expect(mastra.getToolPayloadTransform()).toEqual({
      targets: ['display'],
      transformToolPayload,
    });
  });

  it('normalizes legacy projection policies from config', () => {
    const projectToolPayload = () => ({ safe: true });
    const mastra = new Mastra({
      logger: false,
      toolPayloadProjection: {
        targets: ['display'],
        projectToolPayload,
      },
    } as any);

    expect(mastra.getToolPayloadTransform()).toEqual({
      targets: ['display'],
      transformToolPayload: projectToolPayload,
    });
  });
});
