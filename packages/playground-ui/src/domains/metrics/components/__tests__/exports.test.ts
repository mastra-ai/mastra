import { describe, expect, it } from 'vitest';
import * as entry from '../index';

// Platform composes its own Metrics pages from `@mastra/playground-ui/domains/metrics/components`,
// so every component a card file exports has to be reachable from that entry point.
const componentFiles = import.meta.glob<Record<string, unknown>>(
  ['../*.tsx', '../metrics-grid/*.tsx', '!../**/*.test.tsx'],
  {
    eager: true,
  },
);

/** Building blocks a card file exports for other files in this folder only. */
const INTERNAL = new Set<string>([]);

const exported = new Map<unknown, string>(Object.entries(entry).map(([name, value]) => [value, name]));

describe('@mastra/playground-ui/domains/metrics/components', () => {
  const components = Object.entries(componentFiles).flatMap(([file, mod]) =>
    Object.entries(mod)
      .filter(([name, value]) => /^[A-Z][a-z]/.test(name) && typeof value === 'function' && !INTERNAL.has(name))
      .map(([name, value]) => ({ file, name, value })),
  );

  it.each(components.map(c => [c.name, c.file, c.value] as const))('exports %s from %s', (name, _file, value) => {
    expect(exported.get(value)).toBe(name);
  });

  it('exports what a page outside Studio needs to run the trace aggregate cards', () => {
    expect(entry).toMatchObject({
      TraceAggregateLimiterProvider: expect.any(Function),
      ChartCardError: expect.any(Function),
    });
  });
});
