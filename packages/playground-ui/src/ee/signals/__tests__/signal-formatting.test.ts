import type { SignalCatalogEntry } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import { getSignalHue } from '../signal-colors';
import { getSignalDescription, orderedSignals, signalDescription, signalLabel } from '../signal-formatting';

const customCatalog: SignalCatalogEntry[] = [
  {
    name: 'goal',
    label: 'Goal',
    description: 'Goal description',
    order: 0,
    builtIn: true,
    enabled: true,
    status: 'ready',
  },
  {
    name: 'tool_usage',
    label: 'Tool Usage',
    description: 'How the agent uses tools.',
    order: 1,
    builtIn: false,
    enabled: true,
    status: 'processing',
  },
  {
    name: 'outcome',
    label: 'Outcome',
    description: 'Outcome description',
    order: 2,
    builtIn: true,
    enabled: true,
    status: 'ready',
  },
];

describe('getSignalDescription', () => {
  describe('when the input names an inherited object property', () => {
    it('does not expose it as a signal description', () => {
      expect(getSignalDescription('toString')).toBeUndefined();
      expect(getSignalDescription('__proto__')).toBeUndefined();
    });
  });
});

describe('signal catalog formatting', () => {
  describe('when a custom signal is interleaved with built-ins', () => {
    it('orders and formats signals from catalog metadata', () => {
      expect(orderedSignals(customCatalog, ['outcome', 'goal', 'tool_usage'])).toEqual([
        'goal',
        'tool_usage',
        'outcome',
      ]);
      expect(signalLabel(customCatalog, 'tool_usage')).toBe('Tool Usage');
      expect(signalDescription(customCatalog, 'tool_usage')).toBe('How the agent uses tools.');
    });
  });

  describe('when snapshot data contains an uncatalogued signal', () => {
    it('keeps the signal and derives a readable label', () => {
      expect(orderedSignals(customCatalog, ['goal', 'handoff_quality'])).toEqual(['goal', 'handoff_quality']);
      expect(signalLabel(customCatalog, 'handoff_quality')).toBe('Handoff Quality');
    });
  });
});

describe('getSignalHue', () => {
  describe('when a custom signal name is supplied', () => {
    it('returns stable hues separated from red and built-in hues', () => {
      const names = Array.from({ length: 100 }, (_, index) => `custom_signal_${index}`);
      const assignments = names.map(name => ({ name, hue: getSignalHue(name) }));
      expect(new Set(assignments.map(({ hue }) => hue)).size).toBeGreaterThanOrEqual(50);
      for (const { name, hue } of assignments) {
        expect(getSignalHue(name)).toBe(hue);
        for (const reservedHue of [0, 145, 35, 225, 300]) {
          const distance = Math.abs(hue - reservedHue);
          expect(Math.min(distance, 360 - distance)).toBeGreaterThanOrEqual(30);
        }
      }
    });
  });
});
