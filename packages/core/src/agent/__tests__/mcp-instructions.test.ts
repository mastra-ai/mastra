import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { Agent } from '../index';

vi.mock('posthog-node', () => ({
  PostHog: class {
    capture() {}
    shutdownAsync() {
      return Promise.resolve();
    }
  },
}));

function createCapturingModel(captured: { system?: string }) {
  return new MockLanguageModelV2({
    doGenerate: async options => {
      const systemMessage = options.prompt.find((msg: any) => msg.role === 'system');
      captured.system =
        typeof systemMessage?.content === 'string' ? systemMessage.content : JSON.stringify(systemMessage?.content);

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        text: 'done',
        content: [{ type: 'text', text: 'done' }],
        warnings: [],
      };
    },
  });
}

function mcpTool({
  id,
  serverName,
  serverInstructions,
  forwardInstructions = true,
  instructionsMaxLength = 512,
}: {
  id: string;
  serverName: string;
  serverInstructions?: string;
  forwardInstructions?: boolean;
  instructionsMaxLength?: number;
}) {
  return createTool({
    id,
    description: id,
    inputSchema: z.object({}),
    mcpMetadata: {
      serverName,
      serverInstructions,
      forwardInstructions,
      instructionsMaxLength,
    },
    execute: async () => ({ ok: true }),
  });
}

describe('Agent MCP server instructions', () => {
  it('adds MCP instructions to the final system prompt', async () => {
    const captured: { system?: string } = {};
    const agent = new Agent({
      id: 'mcp-agent',
      name: 'mcp-agent',
      instructions: 'You are helpful.',
      model: createCapturingModel(captured),
      tools: {
        query: mcpTool({
          id: 'query',
          serverName: 'db-tools',
          serverInstructions: 'Always call validate_schema before migrate_schema.',
        }),
      },
    });

    await agent.generate('Run the migration');

    expect(captured.system).toContain('You are helpful.');
    expect(captured.system).toContain('## Guidance from MCP server "db-tools"');
    expect(captured.system).toContain('Always call validate_schema before migrate_schema.');
  });

  it('handles multiple MCP servers in stable server-name order', async () => {
    const captured: { system?: string } = {};
    const agent = new Agent({
      id: 'mcp-agent',
      name: 'mcp-agent',
      instructions: 'Use tools carefully.',
      model: createCapturingModel(captured),
    });

    await agent.generate('Check both systems', {
      toolsets: {
        zeta: {
          zetaTool: mcpTool({
            id: 'zetaTool',
            serverName: 'zeta',
            serverInstructions: 'Use zeta last.',
          }),
        },
        alpha: {
          alphaTool: mcpTool({
            id: 'alphaTool',
            serverName: 'alpha',
            serverInstructions: 'Use alpha first.',
          }),
        },
      },
    });

    const expected = `Use tools carefully.

## Guidance from MCP server "alpha"

Use alpha first.

## Guidance from MCP server "zeta"

Use zeta last.`;

    expect(captured.system).toBe(expected);
  });

  it('does not duplicate guidance when multiple tools come from the same MCP server', async () => {
    const captured: { system?: string } = {};
    const agent = new Agent({
      id: 'mcp-agent',
      name: 'mcp-agent',
      instructions: 'Use tools carefully.',
      model: createCapturingModel(captured),
      tools: {
        query: mcpTool({
          id: 'query',
          serverName: 'db-tools',
          serverInstructions: 'Validate first.',
        }),
        migrate: mcpTool({
          id: 'migrate',
          serverName: 'db-tools',
          serverInstructions: 'Validate first.',
        }),
      },
    });

    await agent.generate('Run migration');

    expect(captured.system?.match(/Guidance from MCP server "db-tools"/g)).toHaveLength(1);
  });

  it('skips empty, disabled, and truncates long MCP instructions', async () => {
    const captured: { system?: string } = {};
    const agent = new Agent({
      id: 'mcp-agent',
      name: 'mcp-agent',
      instructions: 'Use tools carefully.',
      model: createCapturingModel(captured),
      tools: {
        empty: mcpTool({
          id: 'empty',
          serverName: 'empty',
          serverInstructions: '   ',
        }),
        disabled: mcpTool({
          id: 'disabled',
          serverName: 'disabled',
          serverInstructions: 'Do not forward this.',
          forwardInstructions: false,
        }),
        long: mcpTool({
          id: 'long',
          serverName: 'long',
          serverInstructions: '1234567890',
          instructionsMaxLength: 4,
        }),
      },
    });

    await agent.generate('Run checks');

    expect(captured.system).toContain('## Guidance from MCP server "long"\n\n1234');
    expect(captured.system).not.toContain('empty');
    expect(captured.system).not.toContain('disabled');
    expect(captured.system).not.toContain('Do not forward this.');
    expect(captured.system).not.toContain('567890');
  });
});
