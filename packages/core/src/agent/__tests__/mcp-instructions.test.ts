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

function createCapturingModel(captured: { systemMessages: string[] }) {
  return new MockLanguageModelV2({
    doGenerate: async options => {
      captured.systemMessages = options.prompt
        .filter((msg: any) => msg.role === 'system')
        .map((msg: any) => (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)));

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

function mcpToolWithoutForwarding({
  id,
  serverName,
  serverInstructions,
}: {
  id: string;
  serverName: string;
  serverInstructions?: string;
}) {
  return createTool({
    id,
    description: id,
    inputSchema: z.object({}),
    mcpMetadata: {
      serverName,
      serverInstructions,
    },
    execute: async () => ({ ok: true }),
  });
}

describe('Agent MCP server instructions', () => {
  it('adds MCP instructions as a separate system message', async () => {
    const captured: { systemMessages: string[] } = { systemMessages: [] };
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

    // Base instructions remain in their own system message
    expect(captured.systemMessages[0]).toBe('You are helpful.');
    // MCP guidance is a separate system message
    const mcpMessage = captured.systemMessages.find(msg => msg.includes('Guidance from MCP server'));
    expect(mcpMessage).toBeDefined();
    expect(mcpMessage).toContain('## Guidance from MCP server "db-tools"');
    expect(mcpMessage).toContain('Always call validate_schema before migrate_schema.');
  });

  it('handles multiple MCP servers in stable server-name order', async () => {
    const captured: { systemMessages: string[] } = { systemMessages: [] };
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

    // Base instructions stay separate
    expect(captured.systemMessages[0]).toBe('Use tools carefully.');

    const mcpMessage = captured.systemMessages.find(msg => msg.includes('Guidance from MCP server'));
    expect(mcpMessage).toBeDefined();

    // Alpha before zeta (alphabetical)
    const alphaIdx = mcpMessage!.indexOf('alpha');
    const zetaIdx = mcpMessage!.indexOf('zeta');
    expect(alphaIdx).toBeLessThan(zetaIdx);

    expect(mcpMessage).toContain('## Guidance from MCP server "alpha"\n\nUse alpha first.');
    expect(mcpMessage).toContain('## Guidance from MCP server "zeta"\n\nUse zeta last.');
  });

  it('does not duplicate guidance when multiple tools come from the same MCP server', async () => {
    const captured: { systemMessages: string[] } = { systemMessages: [] };
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

    const allText = captured.systemMessages.join('\n');
    expect(allText.match(/Guidance from MCP server "db-tools"/g)).toHaveLength(1);
  });

  it('skips empty, disabled, and truncates long MCP instructions', async () => {
    const captured: { systemMessages: string[] } = { systemMessages: [] };
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

    const allText = captured.systemMessages.join('\n');
    expect(allText).toContain('## Guidance from MCP server "long"\n\n1234');
    expect(allText).not.toContain('empty');
    expect(allText).not.toContain('disabled');
    expect(allText).not.toContain('Do not forward this.');
    expect(allText).not.toContain('567890');
  });

  it('does not add an MCP system message when no tools have instructions', async () => {
    const captured: { systemMessages: string[] } = { systemMessages: [] };
    const agent = new Agent({
      id: 'mcp-agent',
      name: 'mcp-agent',
      instructions: 'You are helpful.',
      model: createCapturingModel(captured),
      tools: {
        plain: createTool({
          id: 'plain',
          description: 'plain tool',
          inputSchema: z.object({}),
          execute: async () => ({ ok: true }),
        }),
      },
    });

    await agent.generate('Hello');

    // Only the base instructions system message, no MCP guidance
    const mcpMessage = captured.systemMessages.find(msg => msg.includes('Guidance from MCP server'));
    expect(mcpMessage).toBeUndefined();
  });

  it('does not forward instructions by default (opt-in required)', async () => {
    const captured: { systemMessages: string[] } = { systemMessages: [] };
    const agent = new Agent({
      id: 'mcp-agent',
      name: 'mcp-agent',
      instructions: 'You are helpful.',
      model: createCapturingModel(captured),
      tools: {
        query: mcpToolWithoutForwarding({
          id: 'query',
          serverName: 'db-tools',
          serverInstructions: 'Always call validate_schema before migrate_schema.',
        }),
      },
    });

    await agent.generate('Run the migration');

    const mcpMessage = captured.systemMessages.find(msg => msg.includes('Guidance from MCP server'));
    expect(mcpMessage).toBeUndefined();
  });
});
