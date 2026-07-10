import type { GatewayLanguageModel } from '@mastra/core/llm';
import { describe, expect, it } from 'vitest';
import { __testing } from './local-cli-provider.js';

type LocalCliModel = Extract<GatewayLanguageModel, { readonly specificationVersion: 'v3' }>;
type CallOptions = Parameters<LocalCliModel['doGenerate']>[0];

function callOptions(overrides: Partial<CallOptions> = {}): CallOptions {
  return {
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'Create the requested file.' }] }],
    tools: [
      {
        type: 'function',
        name: 'write_file',
        description: 'Write a file in the active project.',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string' }, content: { type: 'string' } },
          required: ['path', 'content'],
          additionalProperties: false,
        },
      },
    ],
    ...overrides,
  };
}

describe('local CLI model adapter', () => {
  it('constrains structured output to available tools', () => {
    const schema = __testing.buildStructuredOutputSchema(callOptions({ toolChoice: { type: 'required' } }));

    expect(schema.properties.toolCalls.minItems).toBe(1);
    expect(schema.properties.toolCalls.items.properties.toolName.enum).toEqual(['write_file']);
  });

  it('rejects required tool calls when no tools are available', () => {
    expect(() =>
      __testing.buildStructuredOutputSchema(callOptions({ tools: [], toolChoice: { type: 'required' } })),
    ).toThrow('no function tools are available');
  });

  it('includes the tool schema while denying built-in CLI workspace access', () => {
    const prompt = __testing.formatPromptForCli(callOptions());

    expect(prompt).toContain('Mastra owns every tool, permission, and file change.');
    expect(prompt).toContain('Do not inspect the workspace or run built-in CLI tools.');
    expect(prompt).toContain('Tool write_file');
    expect(prompt).toContain('"additionalProperties":false');
  });

  it('accepts valid tool calls and preserves serialized input', () => {
    const result = __testing.parseStructuredOutput(
      { text: '', toolCalls: [{ toolName: 'write_file', inputJson: '{"path":"READY.txt","content":"OK"}' }] },
      callOptions(),
    );

    expect(result.toolCalls).toEqual([{ toolName: 'write_file', inputJson: '{"path":"READY.txt","content":"OK"}' }]);
  });

  it('rejects unavailable tools and malformed tool input', () => {
    expect(() =>
      __testing.parseStructuredOutput({ text: '', toolCalls: [{ toolName: 'shell', inputJson: '{}' }] }, callOptions()),
    ).toThrow('unavailable tool');
    expect(() =>
      __testing.parseStructuredOutput(
        { text: '', toolCalls: [{ toolName: 'write_file', inputJson: '{' }] },
        callOptions(),
      ),
    ).toThrow('invalid JSON');
  });
});
