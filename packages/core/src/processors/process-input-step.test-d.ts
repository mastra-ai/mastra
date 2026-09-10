import { describe, expectTypeOf, it } from 'vitest';
import type { AgentExecutionOptions } from '../agent/agent.types';
import type { MastraModelSettings, ModelTimeoutSettings } from '../llm/model/model-settings';
import type { ProcessInputStepArgs, ProcessInputStepResult } from './index';
import type { ProcessorInputStepPhaseType, ProcessorStepOutputType } from './step-schema';

/**
 * Issue #23457: processor-received and processor-returned modelSettings should
 * describe Mastra settings (including timeout.stepMs), not only AI SDK CallSettings.
 */
describe('ProcessInputStep modelSettings types', () => {
  it('accepts timeout.stepMs on ProcessInputStepResult without a cast', () => {
    const inline: ProcessInputStepResult = {
      modelSettings: {
        maxOutputTokens: 100,
        timeout: { stepMs: 1000 },
      },
    };

    expectTypeOf(inline.modelSettings).toEqualTypeOf<MastraModelSettings | undefined>();
    expectTypeOf(inline.modelSettings?.timeout).toEqualTypeOf<ModelTimeoutSettings | undefined>();
    expectTypeOf(inline.modelSettings?.timeout?.stepMs).toEqualTypeOf<number | undefined>();
  });

  it('exposes timeout on ProcessInputStepArgs', () => {
    expectTypeOf<ProcessInputStepArgs['modelSettings']>().toEqualTypeOf<MastraModelSettings | undefined>();
    expectTypeOf<NonNullable<ProcessInputStepArgs['modelSettings']>['timeout']>().toEqualTypeOf<
      ModelTimeoutSettings | undefined
    >();
  });

  it('accepts AgentExecutionOptions.modelSettings without a cast', () => {
    const settings: NonNullable<AgentExecutionOptions['modelSettings']> = {
      maxOutputTokens: 100,
      timeout: { stepMs: 1000 },
    };
    const workaround: ProcessInputStepResult = { modelSettings: settings };

    expectTypeOf(workaround.modelSettings).toEqualTypeOf<MastraModelSettings | undefined>();
  });

  it('keeps CallSettings fields and still omits abortSignal', () => {
    expectTypeOf<NonNullable<ProcessInputStepResult['modelSettings']>>().toHaveProperty('maxOutputTokens');
    expectTypeOf<NonNullable<ProcessInputStepResult['modelSettings']>>().toHaveProperty('temperature');
    expectTypeOf<NonNullable<ProcessInputStepResult['modelSettings']>>().toHaveProperty('reasoning');
    expectTypeOf<NonNullable<ProcessInputStepResult['modelSettings']>>().not.toHaveProperty('abortSignal');
  });

  it('uses the same settings type on the workflow processor step schema', () => {
    expectTypeOf<ProcessorInputStepPhaseType['modelSettings']>().toEqualTypeOf<MastraModelSettings | undefined>();
    expectTypeOf<ProcessorStepOutputType['modelSettings']>().toEqualTypeOf<MastraModelSettings | undefined>();
  });
});
