import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import type { Processor } from '../../../../processors';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Mastra-distinctive loop behaviors that aren't part of a vanilla provider loop:
 * active-tools filtering and output processors. These compose with the agentic
 * loop and are easy to regress when the loop is refactored.
 */
describeForAllEngines('AIMock loop scenario: Mastra-distinctive behaviors', engine => {
  const getMock = useLoopScenarioAimock();

  it('only exposes activeTools to the model request', async () => {
    const allowed = createTool({
      id: 'allowed_tool',
      description: 'An allowed tool.',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });
    const blocked = createTool({
      id: 'blocked_tool',
      description: 'A tool that must not be exposed.',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Do the thing.',
      tools: { allowed_tool: allowed, blocked_tool: blocked },
      activeTools: ['allowed_tool'],
      stopWhen: stepCountIs(2),
      fixtures: llm => {
        // The model just answers; we only care about the tool list it was given.
        llm.on({ endpoint: 'chat' }, { content: 'Done.' });
      },
    });

    // The request's tool list contains only the active tool.
    // Only the active tool is sent, and its definition is not changed by the filter.
    const requestTools = (requests[0]?.body as any)?.tools ?? [];
    expect(requestTools).toHaveLength(1);
    expect(requestTools[0]).toMatchObject({
      type: 'function',
      function: {
        name: 'allowed_tool',
        description: 'An allowed tool.',
        parameters: { type: 'object', properties: {} },
      },
    });
  });

  it('applies an output processor that redacts loop text', async () => {
    const redactSecret: Processor = {
      id: 'redact-secret',
      async processOutputStream({ part }) {
        if (part.type === 'text-delta') {
          const anyPart = part as unknown as { payload: { text: string } };
          anyPart.payload.text = anyPart.payload.text.replace(/SECRET/g, '[REDACTED]');
        }
        return part;
      },
    };

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Tell me the secret.',
      outputProcessors: [redactSecret],
      stopWhen: stepCountIs(2),
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'The value is SECRET and must be hidden.' });
      },
    });

    const text = await output.text;
    expect(text).toContain('[REDACTED]');
    expect(text).not.toContain('SECRET');
  });
});
