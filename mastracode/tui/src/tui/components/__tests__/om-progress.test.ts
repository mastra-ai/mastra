import { visibleWidth } from '@earendil-works/pi-tui';
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

import { formatOMContextIndicator } from '../om-progress.js';

function createState(
  values: Partial<{
    pendingTokens: number;
    observationTokens: number;
    threshold: number;
    reflectionThreshold: number;
    messageSavings: number;
    reflectionInput: number;
    reflectionOutput: number;
  }> = {},
) {
  return {
    status: 'idle',
    pendingTokens: values.pendingTokens ?? 0,
    threshold: values.threshold ?? 80_000,
    thresholdPercent: 0,
    observationTokens: values.observationTokens ?? 0,
    reflectionThreshold: values.reflectionThreshold ?? 40_000,
    reflectionThresholdPercent: 0,
    buffered: {
      observations: {
        projectedMessageRemoval: values.messageSavings ?? 0,
      },
      reflection: {
        status: 'complete',
        inputObservationTokens: values.reflectionInput ?? 0,
        observationTokens: values.reflectionOutput ?? 0,
      },
    },
  } as any;
}

describe('formatOMContextIndicator', () => {
  it('renders an empty track for no usage', () => {
    const indicator = formatOMContextIndicator(createState());

    expect(indicator).toMatchObject({
      plain: '[──────────] 0/120k',
      messageCells: 0,
      memoryCells: 0,
      unusedCells: 10,
    });
  });

  it('renders an empty track when combined capacity is zero', () => {
    const indicator = formatOMContextIndicator(createState({ threshold: 0, reflectionThreshold: 0 }));

    expect(indicator.plain).toBe('[──────────] 0/0k');
    expect(indicator.messageCells + indicator.memoryCells).toBe(0);
  });

  it('fills only the left segment for messages', () => {
    expect(formatOMContextIndicator(createState({ pendingTokens: 60_000 })).plain).toBe('[━━━━━─────] 60/120k');
  });

  it('fills only the right segment for memory', () => {
    expect(formatOMContextIndicator(createState({ observationTokens: 60_000 })).plain).toBe('[─────━━━━━] 60/120k');
  });

  it('splits balanced usage into three message cells and two memory cells', () => {
    const indicator = formatOMContextIndicator(createState({ pendingTokens: 30_000, observationTokens: 30_000 }));

    expect(indicator).toMatchObject({
      plain: '[━━━─────━━] 60/120k',
      messageCells: 3,
      memoryCells: 2,
      unusedCells: 5,
    });
  });

  it('splits asymmetric usage into three message cells and one memory cell', () => {
    const indicator = formatOMContextIndicator(createState({ pendingTokens: 45_000, observationTokens: 5_000 }));

    expect(indicator).toMatchObject({
      plain: '[━━━──────━] 50/120k',
      messageCells: 3,
      memoryCells: 1,
      unusedCells: 6,
    });
  });

  it('rounds split ties toward messages', () => {
    const indicator = formatOMContextIndicator(
      createState({ pendingTokens: 20_000, observationTokens: 20_000, threshold: 40_000, reflectionThreshold: 40_000 }),
    );

    expect(indicator).toMatchObject({ messageCells: 3, memoryCells: 2, unusedCells: 5 });
  });

  it('leaves one occupied cell for each nonzero source when possible', () => {
    const indicator = formatOMContextIndicator(
      createState({ pendingTokens: 23_000, observationTokens: 1_000, threshold: 80_000, reflectionThreshold: 40_000 }),
    );

    expect(indicator).toMatchObject({ messageCells: 1, memoryCells: 1, unusedCells: 8 });
  });

  it('fills the track at capacity and clamps over-capacity usage', () => {
    expect(formatOMContextIndicator(createState({ pendingTokens: 80_000, observationTokens: 40_000 }))).toMatchObject({
      messageCells: 7,
      memoryCells: 3,
      unusedCells: 0,
    });
    expect(formatOMContextIndicator(createState({ pendingTokens: 160_000, observationTokens: 80_000 }))).toMatchObject({
      messageCells: 7,
      memoryCells: 3,
      unusedCells: 0,
    });
  });

  it('sums each positive savings source independently', () => {
    const indicator = formatOMContextIndicator(
      createState({ messageSavings: 2_000, reflectionInput: 5_000, reflectionOutput: 1_000 }),
    );

    expect(indicator.plain).toContain('↓6k');
  });

  it('does not let negative savings cancel a positive source', () => {
    const indicator = formatOMContextIndicator(
      createState({ messageSavings: 2_000, reflectionInput: 1_000, reflectionOutput: 5_000 }),
    );

    expect(indicator.plain).toContain('↓2k');
  });

  it('suppresses zero savings and preserves visible width in styled output', () => {
    const indicator = formatOMContextIndicator(createState({ reflectionInput: 300, reflectionOutput: 300 }));

    expect(indicator.plain).not.toContain('↓');
    expect(visibleWidth(indicator.styled)).toBe(visibleWidth(indicator.plain));
  });

  it('allows occupied segments to be styled independently', () => {
    const indicator = formatOMContextIndicator(createState({ pendingTokens: 30_000, observationTokens: 30_000 }), {
      messages: segment => `<orange>${segment}</orange>`,
      memory: segment => `<pink>${segment}</pink>`,
    });

    expect(indicator.styled).toContain('<orange>━━━</orange>');
    expect(indicator.styled).toContain('<pink>━━</pink>');
    expect(indicator.styled).toContain('─────');
  });
});
