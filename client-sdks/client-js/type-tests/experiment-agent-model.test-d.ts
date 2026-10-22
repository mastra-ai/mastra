import { expectTypeOf, test } from 'vitest';
import type { CreateDatasetExperimentParams, TriggerDatasetExperimentParams } from '../src/types';

test('triggerDatasetExperiment accepts an agentModel override', () => {
  expectTypeOf<TriggerDatasetExperimentParams['agentModel']>().toEqualTypeOf<
    { provider: string; modelId: string } | undefined
  >();
});

test('createDatasetExperiment does not accept an agentModel override', () => {
  expectTypeOf<CreateDatasetExperimentParams>().not.toHaveProperty('agentModel');
});
