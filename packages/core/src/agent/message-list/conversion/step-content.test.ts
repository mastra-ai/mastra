import { describe, expect, it } from 'vitest';
import { StepContentExtractor } from './step-content';

describe('StepContentExtractor', () => {
  const stepContentFn = (message?: { content?: unknown }) =>
    Array.isArray(message?.content) ? message.content : message?.content ? [message.content] : [];

  it('returns first step content when the message starts with a step-start marker', () => {
    const uiMessages = [
      {
        id: 'msg-1',
        role: 'assistant' as const,
        parts: [{ type: 'step-start' as const }, { type: 'text' as const, text: 'Only step' }],
      },
    ];

    expect(StepContentExtractor.extractStepContent(uiMessages, 1, stepContentFn)).toEqual([
      { type: 'text', text: 'Only step' },
    ]);
    expect(StepContentExtractor.extractStepContent(uiMessages, 1, stepContentFn)).toEqual(
      StepContentExtractor.extractStepContent(uiMessages, -1, stepContentFn),
    );
  });

  it('does not shift numbered steps when the first part is step-start', () => {
    const uiMessages = [
      {
        id: 'msg-1',
        role: 'assistant' as const,
        parts: [
          { type: 'step-start' as const },
          { type: 'text' as const, text: 'Step one' },
          { type: 'step-start' as const },
          { type: 'text' as const, text: 'Step two' },
        ],
      },
    ];

    expect(StepContentExtractor.extractStepContent(uiMessages, 1, stepContentFn)).toEqual([
      { type: 'text', text: 'Step one' },
    ]);
    expect(StepContentExtractor.extractStepContent(uiMessages, 2, stepContentFn)).toEqual([
      { type: 'text', text: 'Step two' },
    ]);
    expect(StepContentExtractor.extractStepContent(uiMessages, -1, stepContentFn)).toEqual([
      { type: 'text', text: 'Step two' },
    ]);
  });
});
