import { describe, expect, it } from 'vitest';
import { getOfflineReadiness } from './offline-readiness';

describe('getOfflineReadiness', () => {
  it('asks the user to start the local runtime before checking model availability', () => {
    expect(
      getOfflineReadiness({
        isLocalModelApplied: true,
        modelProbe: { ok: true, modelUrl: 'http://localhost:1234/v1', models: ['loaded-model'] },
        providerName: 'LM Studio',
        runtimeState: 'idle',
      }),
    ).toEqual({
      label: 'Start runtime',
      message: 'Open the bundled template to start the local Mastra runtime.',
      variant: 'neutral',
    });
  });

  it('asks the user to apply model settings before reporting offline readiness', () => {
    expect(
      getOfflineReadiness({
        isLocalModelApplied: false,
        modelProbe: { ok: true, modelUrl: 'http://localhost:1234/v1', models: ['loaded-model'] },
        providerName: 'LM Studio',
        runtimeState: 'running',
      }),
    ).toMatchObject({
      label: 'Apply model',
      variant: 'neutral',
    });
  });

  it('reports the local Studio ready when the runtime and model server are both available', () => {
    expect(
      getOfflineReadiness({
        isLocalModelApplied: true,
        modelProbe: { ok: true, modelUrl: 'http://localhost:1234/v1', models: ['loaded-model'] },
        providerName: 'LM Studio',
        runtimeState: 'running',
      }),
    ).toEqual({
      label: 'Offline ready',
      message: 'Ready for offline local Studio with LM Studio. Internet is not required for this local runtime.',
      variant: 'success',
    });
  });

  it('does not report offline readiness when the local model server is unreachable', () => {
    expect(
      getOfflineReadiness({
        isLocalModelApplied: true,
        modelProbe: {
          ok: false,
          modelUrl: 'http://localhost:1234/v1',
          models: [],
          error: 'ECONNREFUSED',
        },
        providerName: 'LM Studio',
        runtimeState: 'running',
      }),
    ).toEqual({
      label: 'Model offline',
      message: 'Start LM Studio, load a model, then probe again.',
      variant: 'error',
    });
  });
});
