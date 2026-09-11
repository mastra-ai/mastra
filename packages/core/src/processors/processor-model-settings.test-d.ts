import { assertType, describe, expectTypeOf, it } from 'vitest';
import type { ModelTimeoutSettings } from '../llm/model';
import type { ProcessInputStepArgs, ProcessInputStepResult } from './index';

describe('processor step modelSettings type surface (issue #23457)', () => {
  it('accepts an inline timeout field on ProcessInputStepResult', () => {
    // Object-literal excess-property check: previously errored with TS2353 because
    // modelSettings was typed as Omit<CallSettings, 'abortSignal'> (no `timeout`).
    assertType<ProcessInputStepResult>({
      modelSettings: {
        maxOutputTokens: 100,
        timeout: { stepMs: 1000 },
      },
    });
  });

  it('exposes timeout when reading modelSettings from ProcessInputStepArgs', () => {
    // Previously errored with TS2339 (`timeout` did not exist on the narrow type).
    const read = (args: ProcessInputStepArgs) => args.modelSettings?.timeout;
    expectTypeOf(read).returns.toEqualTypeOf<ModelTimeoutSettings | undefined>();
  });
});
