import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent/agent';
import { PIIDetector } from './pii-detector';

const ssn = '123-45-6789';

function detectorModel() {
  const result = {
    categories: [{ type: 'ssn', score: 0.95 }],
    detections: [{ type: 'ssn', value: ssn, confidence: 0.95, start: 0, end: ssn.length, redacted_value: null }],
    redacted_content: null,
  };
  return new MockLanguageModelV1({
    defaultObjectGenerationMode: 'json',
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 20 },
      text: JSON.stringify(result),
    }),
  });
}

describe('PIIDetector in Agent.generate (#25553)', () => {
  it('never sends an SSN-only user message to the model when remove redaction empties it', async () => {
    const prompts: unknown[] = [];
    const agent = new Agent({
      id: 'pii-agent',
      name: 'PII agent',
      instructions: 'You are helpful.',
      model: new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          prompts.push(prompt);
          return {
            content: [{ type: 'text', text: 'ok' }],
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            warnings: [],
          };
        },
      }),
      inputProcessors: [new PIIDetector({ model: detectorModel(), strategy: 'redact', redactionMethod: 'remove' })],
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await agent.generate(ssn);

    expect(result.text).toBe('ok');
    expect(JSON.stringify(prompts)).not.toContain(ssn);
    // The dropped message was the only user message, so the model gets no user turn (same as strategy 'filter')
    expect((prompts[0] as Array<{ role: string }>).some(m => m.role === 'user')).toBe(false);
  });
});
