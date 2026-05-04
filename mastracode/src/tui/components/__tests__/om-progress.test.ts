import { describe, expect, it, vi } from 'vitest';

vi.mock('chalk', () => {
  const makeChain = (): any =>
    new Proxy((value: string) => value, {
      get: (_target, prop) => {
        if (prop === 'call' || prop === 'apply' || prop === 'bind') return Reflect.get(_target, prop);
        if (['hex', 'bgHex', 'rgb', 'bgRgb'].includes(prop as string)) return () => makeChain();
        return makeChain();
      },
    });

  return { default: makeChain() };
});

vi.mock('../../theme.js', () => ({
  theme: {
    fg: (_tone: string, value: string) => value,
  },
  mastra: {
    red: '#ef4444',
    orange: '#f97316',
    darkGray: '#52525b',
    specialGray: '#6b7280',
    pink: '#ec4899',
  },
}));

import { formatObservationStatus, formatReflectionStatus } from '../om-progress.js';

const baseState = {
  status: 'idle',
  pendingTokens: 8200,
  threshold: 30000,
  thresholdPercent: 27,
  observationTokens: 9100,
  reflectionThreshold: 40000,
  reflectionThresholdPercent: 23,
  buffered: {
    observations: {
      projectedMessageRemoval: 0,
    },
    reflection: {
      status: 'idle',
      inputObservationTokens: 0,
      observationTokens: 0,
    },
  },
} as any;

describe('om progress label styling', () => {
  it('renders messages label without bold styling by default', () => {
    const rendered = formatObservationStatus(baseState, 'full');

    expect(rendered).toContain('messages ');
  });

  it('renders memory label without bold styling by default', () => {
    const rendered = formatReflectionStatus(baseState, 'full');

    expect(rendered).toContain('memory ');
  });

  it('hides reflection savings when compression saved no tokens', () => {
    const rendered = formatReflectionStatus(
      {
        ...baseState,
        observationTokens: 300,
        buffered: {
          ...baseState.buffered,
          reflection: {
            status: 'complete',
            inputObservationTokens: 300,
            observationTokens: 300,
          },
        },
      },
      'full',
    );

    expect(rendered).toContain('memory 0.3/40k');
    expect(rendered).not.toContain('↓');
    expect(rendered).not.toContain('-0k');
  });
});
