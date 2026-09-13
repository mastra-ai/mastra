import { describe, expect, it, vi } from 'vitest';
import { z as z4 } from 'zod/v4';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { CoreToolBuilder } from './builder';

function baseOptions(overrides: Record<string, unknown> = {}) {
  return {
    name: 'shared-tool',
    backgroundConfig: { enabled: true },
    logger: {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      trackException: vi.fn(),
    } as any,
    requestContext: new RequestContext(),
    ...overrides,
  };
}

function modelFacingProperties(built: { parameters?: unknown }) {
  const parameters = built.parameters as { jsonSchema?: { type?: string; properties?: Record<string, unknown> } };
  expect(parameters?.jsonSchema).toBeDefined();
  return parameters.jsonSchema!.properties as Record<string, unknown>;
}

describe('CoreToolBuilder cross-agent _background leak (issue #22843)', () => {
  it('does not leak _background into an agent that did not opt in', () => {
    const tool = createTool({
      id: 'shared-search',
      description: 'Shared search tool',
      inputSchema: z4.object({ query: z4.string() }),
      execute: vi.fn(),
    });
    const before = tool.inputSchema;

    const eligible = new CoreToolBuilder({
      originalTool: tool,
      options: baseOptions(),
      backgroundTaskEnabled: true,
    }).build();
    expect(modelFacingProperties(eligible)).toHaveProperty('_background');

    const ineligible = new CoreToolBuilder({
      originalTool: tool,
      options: baseOptions({ backgroundConfig: undefined }),
      backgroundTaskEnabled: true,
    }).build();
    expect(modelFacingProperties(ineligible)).not.toHaveProperty('_background');

    expect(tool.inputSchema).toBe(before);
  });

  it('is order-independent when the opted-out agent converts first', () => {
    const tool = createTool({
      id: 'shared-search',
      description: 'Shared search tool',
      inputSchema: z4.object({ query: z4.string() }),
      execute: vi.fn(),
    });

    const ineligible = new CoreToolBuilder({
      originalTool: tool,
      options: baseOptions({ backgroundConfig: undefined }),
      backgroundTaskEnabled: true,
    }).build();
    expect(modelFacingProperties(ineligible)).not.toHaveProperty('_background');

    const eligible = new CoreToolBuilder({
      originalTool: tool,
      options: baseOptions(),
      backgroundTaskEnabled: true,
    }).build();
    expect(modelFacingProperties(eligible)).toHaveProperty('_background');
  });
});
