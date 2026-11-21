import { describe, expect, it } from 'vitest';

import { diffFrames } from './compare';
import { baselineFrames, knownDifferencesFor, observationApplies, parseFrames } from './expected';
import { BASELINES, FACT_BASELINES, OBSERVATIONS, UNFILED, UNFILED_DIFFERENCES } from './known-differences';
import { SCENARIO_NAMES, getScenario, readersOf } from './scenarios';
import { ENGINES, LAYOUTS, isFact, layoutName } from './types';
import type { Cell } from './types';

const CELLS: Cell[] = LAYOUTS.flatMap(layout =>
  ENGINES.flatMap(engine =>
    SCENARIO_NAMES.filter(
      scenario => !getScenario(scenario).layouts || getScenario(scenario).layouts!.includes(layoutName(layout)),
    ).map(scenario => ({ scenario, engine, ...layout })),
  ),
);

/** Checks the observations file itself, for every grid group. Needs no Redis. */
describe('observations', () => {
  it('each names a ticket, a cause and evidence, and describes cells the grid runs', () => {
    for (const o of OBSERVATIONS) {
      const label = `${o.scenario} ${o.engines.join('/')} ${o.readers.join('/')}`;
      expect(SCENARIO_NAMES, label).toContain(o.scenario);
      for (const a of [o, o.againstLive, o.againstPlain].filter(x => x !== undefined)) {
        if (a.ticket === UNFILED)
          expect(
            Object.values(UNFILED_DIFFERENCES).map(u => u.evidence),
            label,
          ).toContain(a.evidence);
        else expect(a.ticket, label).toMatch(/^[A-Z]+-\d+$/);
        expect(['durable-stream', 'engine', 'plain-layer'], label).toContain(a.cause);
        expect(a.evidence, label).toMatch(/\.ts:\d+/);
      }
      for (const layout of o.layouts ?? []) expect(LAYOUTS.map(layoutName), label).toContain(layout);
      // An observation that matches the baseline everywhere it applies is stale.
      const changes = CELLS.some(cell =>
        readersOf(getScenario(cell.scenario)).some(reader => {
          if (!observationApplies(o, cell, reader)) return false;
          const baseline = baselineFrames(cell.scenario, reader);
          return diffFrames(baseline, parseFrames(o.frames, baseline)) !== undefined;
        }),
      );
      expect(changes, `${label}: matches the baseline, so it explains nothing`).toBe(true);
    }
  });

  it('describe each reader of each cell at most once and explain every derived difference', () => {
    for (const cell of CELLS) expect(() => knownDifferencesFor(cell)).not.toThrow();
  });

  it('have a baseline for every reader of every scenario', () => {
    for (const name of SCENARIO_NAMES) {
      const readers = readersOf(getScenario(name));
      if (readers.some(r => !isFact(r))) expect(BASELINES, name).toHaveProperty([name]);
      for (const fact of readers.filter(isFact)) expect(FACT_BASELINES[name], `${name} ${fact}`).toHaveProperty([fact]);
    }
    const streamScenarios = SCENARIO_NAMES.filter(n => readersOf(getScenario(n)).some(r => !isFact(r)));
    expect(Object.keys(BASELINES).sort()).toEqual(streamScenarios.sort());
  });
});
