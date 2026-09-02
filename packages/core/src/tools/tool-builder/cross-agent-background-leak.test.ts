/**
 * Reproduction for the cross-agent `_background` leak.
 *
 * `CoreToolBuilder` writes the schema it injects back onto
 * `originalTool.inputSchema` — the caller's own tool object, which is typically
 * a module-level singleton shared by several agents.
 *
 * That was harmless while eligibility was a single Mastra-level boolean: every
 * agent in a process got the same answer, so the write-back was a no-op
 * difference. Since #22777 eligibility is resolved per agent and per tool
 * (`isToolBackgroundEligible`), but the object is still shared, so the first
 * agent to convert the tool decides what every other agent's model sees.
 *
 * The second test is the control: reversing the conversion order flips the
 * result, which rules out "the tool is simply always eligible".
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../../request-context';
import { isStandardSchemaWithJSON, standardSchemaToJSONSchema } from '../../schema';
import { createTool } from '../../tools';
import { CoreToolBuilder } from './builder';

function toolOptions(name: string, agentBackgroundConfig?: unknown) {
  return {
    name,
    logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trackException: vi.fn() },
    requestContext: new RequestContext(),
    agentBackgroundConfig,
  } as any;
}

/** The input properties the model actually receives for a built tool. */
function modelFacingProperties(built: any): Record<string, unknown> {
  const parameters = built.parameters;
  if (parameters?.jsonSchema?.properties) return parameters.jsonSchema.properties;
  if (isStandardSchemaWithJSON(parameters)) {
    return ((standardSchemaToJSONSchema(parameters as any, { io: 'input' }) as any).properties ?? {}) as Record<
      string,
      unknown
    >;
  }
  return {};
}

/** One module-level tool instance, as tools are normally authored. */
function sharedSearchTool() {
  return createTool({
    id: 'search',
    description: 'Search the web',
    inputSchema: z.object({ query: z.string() }),
    execute: vi.fn(),
  });
}

const OPTED_IN = { tools: { search: true } };

describe('cross-agent `_background` leak', () => {
  it('leaks into an agent that opted nothing in, when the opted-in agent converts first', () => {
    const searchTool = sharedSearchTool();

    // Agent A whitelists `search` for background execution.
    const builtForA = new CoreToolBuilder({
      originalTool: searchTool,
      options: toolOptions('search', OPTED_IN),
      backgroundTaskEnabled: true,
    }).build();

    // Agent B shares the same tool instance and has no background config.
    const builtForB = new CoreToolBuilder({
      originalTool: searchTool,
      options: toolOptions('search', undefined),
      backgroundTaskEnabled: true,
    }).build();

    expect(modelFacingProperties(builtForA)).toHaveProperty('_background');

    // B never opted in, so `resolveBackgroundConfig` would discard any
    // `_background` its model emits. It should not be advertised the field.
    expect(modelFacingProperties(builtForB)).not.toHaveProperty('_background');
  });

  it('control: the same two agents in the opposite order leave B clean', () => {
    const searchTool = sharedSearchTool();

    const builtForB = new CoreToolBuilder({
      originalTool: searchTool,
      options: toolOptions('search', undefined),
      backgroundTaskEnabled: true,
    }).build();

    new CoreToolBuilder({
      originalTool: searchTool,
      options: toolOptions('search', OPTED_IN),
      backgroundTaskEnabled: true,
    }).build();

    expect(modelFacingProperties(builtForB)).not.toHaveProperty('_background');
  });
});
