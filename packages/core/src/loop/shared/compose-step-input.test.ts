import { describe, it, expect } from 'vitest';
import type { MastraLanguageModel } from '../../llm/model/shared.types';
import type { RunProcessInputStepResult } from '../../processors';
import { composeStepInput } from './compose-step-input';

const model = { provider: 'openai', modelId: 'gpt-4o-mini' } as unknown as MastraLanguageModel;
const modelOverride = { provider: 'anthropic', modelId: 'claude' } as unknown as MastraLanguageModel;

function baseCurrent() {
  return {
    messageId: 'msg-original',
    model,
    tools: { foo: { id: 'foo' } },
    toolChoice: 'auto' as any,
    activeTools: ['foo'] as string[] | undefined,
    providerOptions: { openai: { reasoningEffort: 'high' } },
    modelSettings: { temperature: 0.2, headers: { 'x-a': '1' } },
    structuredOutput: undefined,
  };
}

describe('composeStepInput', () => {
  it('returns current verbatim when processor result is undefined', () => {
    const current = baseCurrent();
    expect(composeStepInput(current, undefined)).toEqual(current);
  });

  it('returns current verbatim when processor result is empty', () => {
    const current = baseCurrent();
    expect(composeStepInput(current, {} as RunProcessInputStepResult)).toEqual(current);
  });

  it('lets the processor result fully replace overridden fields', () => {
    const current = baseCurrent();
    const result: RunProcessInputStepResult = {
      messageId: 'msg-new',
      model: modelOverride,
      tools: { bar: { id: 'bar' } } as any,
      toolChoice: 'none' as any,
      activeTools: ['bar'],
      providerOptions: { anthropic: { thinking: true } } as any,
      modelSettings: { temperature: 0.9 } as any,
    };
    const merged = composeStepInput(current, result);
    expect(merged.messageId).toBe('msg-new');
    expect(merged.model).toBe(modelOverride);
    expect(merged.tools).toEqual({ bar: { id: 'bar' } });
    expect(merged.toolChoice).toBe('none');
    expect(merged.activeTools).toEqual(['bar']);
    expect(merged.providerOptions).toEqual({ anthropic: { thinking: true } });
    // modelSettings is REPLACED not shallow-merged — this is the parity fix.
    expect(merged.modelSettings).toEqual({ temperature: 0.9 });
  });

  it('preserves fields the processor did not include', () => {
    const current = baseCurrent();
    const result = { messageId: 'msg-new' } as RunProcessInputStepResult;
    const merged = composeStepInput(current, result);
    expect(merged.messageId).toBe('msg-new');
    expect(merged.tools).toBe(current.tools);
    expect(merged.toolChoice).toBe(current.toolChoice);
    expect(merged.activeTools).toEqual(['foo']);
    expect(merged.modelSettings).toEqual(current.modelSettings);
    expect(merged.providerOptions).toEqual(current.providerOptions);
  });

  it('lets the processor clear an optional field with an explicit undefined', () => {
    const current = baseCurrent();
    const result = { activeTools: undefined } as RunProcessInputStepResult;
    const merged = composeStepInput(current, result);
    expect(merged.activeTools).toBeUndefined();
  });
});
