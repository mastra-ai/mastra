import { format } from 'node:util';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Processor } from '../../processors';
import { Agent } from '../agent';

const alwaysBlock: Processor = {
  id: 'always-block',
  processInput: async ({ abort }) => abort('blocked on purpose'),
};

describe('input processor tripwire logging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the tripwire without printing a step error or a stack trace', async () => {
    const printed: string[] = [];
    for (const method of ['error', 'warn', 'info', 'log', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        printed.push(format(...args));
      });
    }
    const doGenerate = vi.fn();
    const agent = new Agent({
      id: 'blocker',
      name: 'blocker',
      instructions: 'test',
      model: new MockLanguageModelV2({ doGenerate }),
      inputProcessors: [alwaysBlock],
    });

    const result = await agent.generate('hello');

    expect(result.tripwire).toMatchObject({ reason: 'blocked on purpose', processorId: 'always-block' });
    expect(doGenerate).not.toHaveBeenCalled();
    const output = printed.join('\n');
    expect(output).not.toContain('Error executing step');
    expect(output).not.toMatch(/\n\s+at /);
  });
});
