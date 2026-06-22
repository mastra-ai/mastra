import { describe, it, expect } from 'vitest';
import type { Processor } from '../../../../processors';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: input processors run before the model request.
 *
 * An input processor mutates the user message (here, redacting a secret token)
 * before the loop serializes the first request. We assert the redaction lands in
 * `requests[0]` — i.e. the model never sees the raw secret. A regression where
 * input processors are skipped or run after request assembly is caught here.
 */
describe('AIMock loop scenario: input processor', () => {
  const getMock = useLoopScenarioAimock();

  it('redacts the user message before it reaches the model request', async () => {
    const redactInput: Processor = {
      id: 'redact-input-secret',
      processInput({ messages }) {
        return messages.map(message => {
          if (message.role !== 'user') return message;
          return {
            ...message,
            content: {
              ...message.content,
              parts: message.content.parts?.map(part => {
                if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
                  return { ...part, text: part.text.replace(/INPUT_SECRET/g, '[REDACTED]') };
                }
                return part;
              }),
            },
          };
        });
      },
    };

    const { requests, output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'My password is INPUT_SECRET, please acknowledge.',
      inputProcessors: [redactInput],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Acknowledged.' });
      },
    });

    expect(requests).toHaveLength(1);
    const serialized = JSON.stringify(requests[0]?.body?.messages ?? []);
    expect(serialized).toContain('[REDACTED]');
    expect(serialized).not.toContain('INPUT_SECRET');

    const text = await output.text;
    expect(text).toContain('Acknowledged.');
  });
});
