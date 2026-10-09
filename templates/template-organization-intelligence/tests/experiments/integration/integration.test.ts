import { describe, expect, it } from 'vitest';

import { seedExperimentDatasets } from '../../../src/mastra/evaluation/datasets.js';
import { runNativeExperiment } from '../../../src/mastra/evaluation/experiments.js';

import { openRuntime } from './helpers/runtime.js';

describe('Native comparable experiments', () => {
  it('experiment datasets are idempotent and versioned', async () => {
    const fixture = await openRuntime();
    try {
      const first = await seedExperimentDatasets(fixture.runtime);
      const second = await seedExperimentDatasets(fixture.runtime);
      expect(second).toEqual(first);
      expect((await fixture.runtime.agentDataset.listVersions()).versions).toHaveLength(1);
      expect(await fixture.runtime.agentDataset.listItems({ version: first.agentVersion })).toHaveLength(30);
      const versioned = await fixture.runtime.agentDataset.listItems({ version: first.agentVersion });
      const item = (Array.isArray(versioned) ? versioned : versioned.items)[0]!;
      await fixture.runtime.agentDataset.updateItem({
        itemId: item.id,
        input: `${String(item.input)} (revised)`,
        groundTruth: item.groundTruth ?? {},
        metadata: item.metadata ?? {},
      });
      const changedVersion = (await fixture.runtime.agentDataset.getDetails()).version;
      expect(changedVersion).toBeGreaterThan(first.agentVersion);
      const original = await fixture.runtime.agentDataset.listItems({ version: first.agentVersion });
      const changed = await fixture.runtime.agentDataset.listItems({ version: changedVersion });
      expect((Array.isArray(original) ? original : original.items)[0]!.input).toBe(item.input);
      expect((Array.isArray(changed) ? changed : changed.items)[0]!.input).toContain('(revised)');
      expect((await fixture.runtime.agentDataset.listVersions()).versions).toHaveLength(2);
      const changedItem = (Array.isArray(changed) ? changed : changed.items)[0]!;
      await fixture.runtime.agentDataset.updateItem({
        itemId: changedItem.id,
        input: changedItem.input,
        groundTruth: changedItem.groundTruth,
        metadata: { ...(changedItem.metadata ?? {}), fixtureVersion: 'mismatched-fixture' },
      });
      await expect(
        runNativeExperiment(fixture.runtime, {
          family: 'agent',
          version: (await fixture.runtime.agentDataset.getDetails()).version,
        }),
      ).rejects.toThrow('fixture version');
      const originalListItems = fixture.runtime.agentDataset.listItems.bind(fixture.runtime.agentDataset);
      const mutableAgentDataset = fixture.runtime.agentDataset as unknown as {
        listItems: typeof fixture.runtime.agentDataset.listItems;
      };
      mutableAgentDataset.listItems = async () => [];
      await expect(
        runNativeExperiment(fixture.runtime, { family: 'agent', version: first.agentVersion }),
      ).rejects.toThrow('one to 30 cases');
      mutableAgentDataset.listItems = async () => Array.from({ length: 31 }, () => item) as never;
      await expect(
        runNativeExperiment(fixture.runtime, { family: 'agent', version: first.agentVersion }),
      ).rejects.toThrow('one to 30 cases');
      mutableAgentDataset.listItems = async () => [{ ...item, input: '' }] as never;
      await expect(
        runNativeExperiment(fixture.runtime, { family: 'agent', version: first.agentVersion }),
      ).rejects.toThrow('dataset item is invalid');
      mutableAgentDataset.listItems = originalListItems;
      const originalCalibrationItems = fixture.runtime.calibrationDataset.listItems.bind(
        fixture.runtime.calibrationDataset,
      );
      const mutableCalibrationDataset = fixture.runtime.calibrationDataset as unknown as {
        listItems: typeof fixture.runtime.calibrationDataset.listItems;
      };
      mutableCalibrationDataset.listItems = async () => [{ input: {}, metadata: item.metadata }] as never;
      await expect(
        runNativeExperiment(fixture.runtime, { family: 'calibration', version: first.calibrationVersion }),
      ).rejects.toThrow();
      mutableCalibrationDataset.listItems = originalCalibrationItems;
      expect(fixture.counters).toMatchObject({ answer: 0, judge: 0 });
    } finally {
      await fixture.close();
    }
  });
});
