import { describe, expect, it } from 'vitest';
import { injectAutoResumeToolSchemas } from './auto-resume-tools';

const openAIModel = {
  modelId: 'gpt-4.1-mini',
  provider: 'openai.responses',
  supportsStructuredOutputs: true,
};

function functionTool(name: string) {
  return {
    type: 'function' as const,
    name,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  };
}

describe('injectAutoResumeToolSchemas', () => {
  it('injects the exact compatible resume schema into only the suspended tool', () => {
    const suspended = functionTool('suspended-tool');
    const unrelated = functionTool('unrelated-tool');

    const result = injectAutoResumeToolSchemas({
      tools: [suspended, unrelated],
      suspendedTools: [
        {
          toolName: 'suspended-tool',
          resumeSchema: JSON.stringify({
            type: 'object',
            description: 'Whether the user confirmed the action',
            properties: {
              confirmed: { type: 'boolean' },
            },
          }),
        },
      ],
      model: openAIModel,
    });

    expect(result?.[1]).toBe(unrelated);
    expect(result?.[1]?.inputSchema).toEqual(unrelated.inputSchema);

    const schema = result?.[0]?.inputSchema as any;
    expect(schema.required).toEqual(['query', 'suspendedToolRunId', 'resumeData']);
    expect(schema.properties.suspendedToolRunId).toMatchObject({ type: 'string' });
    expect(schema.properties.resumeData).toMatchObject({
      type: 'object',
      required: ['confirmed'],
      additionalProperties: false,
      description: 'Whether the user confirmed the action',
    });
    expect(schema.properties.resumeData.properties.confirmed).toMatchObject({
      anyOf: [{ type: 'boolean' }, { type: 'null' }],
    });
  });

  it('injects resume controls into an object schema expressed as a root reference', () => {
    const result = injectAutoResumeToolSchemas({
      tools: [
        {
          type: 'function',
          name: 'target',
          inputSchema: {
            $ref: '#/$defs/args',
            $defs: {
              args: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                },
                required: ['query'],
                additionalProperties: false,
              },
            },
          },
        },
      ],
      suspendedTools: [
        {
          toolName: 'target',
          resumeSchema: {
            type: 'object',
            properties: { confirmed: { type: 'boolean' } },
          },
        },
      ],
      model: {
        modelId: 'test-model',
        provider: 'test-provider',
        supportsStructuredOutputs: false,
      },
    });

    const schema = result?.[0]?.inputSchema as any;
    expect(schema.$ref).toBeUndefined();
    expect(schema.required).toEqual(['query', 'suspendedToolRunId', 'resumeData']);
    expect(schema.properties.query).toEqual({ type: 'string' });
    expect(schema.properties.suspendedToolRunId).toMatchObject({ type: 'string' });
    expect(schema.properties.resumeData).toMatchObject({ type: 'object' });
  });

  it.each([
    ['primitive', { type: 'string', minLength: 1 }],
    ['array', { type: 'array', items: { type: 'string' } }],
  ])('preserves a %s resume schema', (_name, resumeSchema) => {
    const result = injectAutoResumeToolSchemas({
      tools: [functionTool('target')],
      suspendedTools: [{ toolName: 'target', resumeSchema }],
      model: {
        modelId: 'test-model',
        provider: 'test-provider',
        supportsStructuredOutputs: false,
      },
    });

    expect((result?.[0]?.inputSchema as any).properties.resumeData).toMatchObject(resumeSchema);
  });

  it('combines distinct resume schemas for parallel suspensions of the same tool', () => {
    const result = injectAutoResumeToolSchemas({
      tools: [functionTool('target')],
      suspendedTools: [
        { toolName: 'target', resumeSchema: { type: 'object', properties: { approved: { type: 'boolean' } } } },
        { toolName: 'target', resumeSchema: { type: 'object', properties: { answer: { type: 'string' } } } },
      ],
      model: {
        modelId: 'test-model',
        provider: 'test-provider',
        supportsStructuredOutputs: false,
      },
    });

    expect((result?.[0]?.inputSchema as any).properties.resumeData.anyOf).toHaveLength(2);
  });

  it('rewrites local references when nesting the resume schema under resumeData', () => {
    const result = injectAutoResumeToolSchemas({
      tools: [functionTool('target')],
      suspendedTools: [
        {
          toolName: 'target',
          resumeSchema: {
            $ref: '#/$defs/answer',
            $defs: {
              answer: {
                type: 'object',
                properties: { value: { type: 'string' } },
                required: ['value'],
              },
            },
          },
        },
      ],
      model: {
        modelId: 'test-model',
        provider: 'test-provider',
        supportsStructuredOutputs: false,
      },
    });

    expect((result?.[0]?.inputSchema as any).properties.resumeData.$ref).toBe('#/properties/resumeData/$defs/answer');
  });

  it('rewrites recursive root references to the nested resumeData schema', () => {
    const result = injectAutoResumeToolSchemas({
      tools: [functionTool('target')],
      suspendedTools: [
        {
          toolName: 'target',
          resumeSchema: {
            type: 'object',
            properties: {
              next: { $ref: '#' },
            },
          },
        },
      ],
      model: {
        modelId: 'test-model',
        provider: 'test-provider',
        supportsStructuredOutputs: false,
      },
    });

    expect((result?.[0]?.inputSchema as any).properties.resumeData.properties.next.$ref).toBe(
      '#/properties/resumeData',
    );
  });

  it('leaves tools unchanged when suspension metadata has no representable resume schema', () => {
    const tool = functionTool('target');
    const result = injectAutoResumeToolSchemas({
      tools: [tool],
      suspendedTools: [{ toolName: 'target', resumeSchema: '{}' }],
      model: openAIModel,
    });

    expect(result?.[0]).toBe(tool);
  });
});
