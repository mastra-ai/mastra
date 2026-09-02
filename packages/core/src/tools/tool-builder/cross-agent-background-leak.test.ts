/**
 * Regression coverage for the cross-agent `_background` leak.
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
 * The second test is the control: before the fix, reversing the conversion order
 * flipped the result, which ruled out "the tool is simply always eligible".
 *
 * The third guards the coupling that makes the naive fix wrong: the write-back
 * was also how the framework's own injected keys reached the tool body past
 * `Tool.execute`'s validation, which strips undeclared keys. Nothing covered
 * that, so removing the write-back could silently break sub-agent and workflow
 * resume (`suspendedToolRunId` arrives in args and gates `shouldResumeSubAgent`).
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
  it('still delivers framework-injected keys to the tool body (no compat layer)', async () => {
    const inner = vi.fn().mockResolvedValue({ ok: true });

    // Mirrors a sub-agent tool: the framework's own schema does not declare
    // `suspendedToolRunId`; the builder injects it because the id is `agent-`
    // prefixed. `baseOptions` has no model, so no provider compat layer applies
    // — the path where `Tool.execute` would otherwise run its own validation.
    const subAgentTool = createTool({
      id: 'agent-researcher',
      description: 'Delegate to the researcher agent',
      inputSchema: z.object({ prompt: z.string() }),
      execute: inner,
    });

    const built = new CoreToolBuilder({
      originalTool: subAgentTool,
      options: toolOptions('agent-researcher'),
    }).build();

    await built.execute!(
      { prompt: 'go', suspendedToolRunId: 'run_abc' } as any,
      {
        toolCallId: 'call-1',
        messages: [],
      } as any,
    );

    expect(inner).toHaveBeenCalledTimes(1);
    expect(inner.mock.calls[0]![0]).toMatchObject({ prompt: 'go', suspendedToolRunId: 'run_abc' });
  });

  it('still rejects invalid input for a tool with injected keys', async () => {
    const inner = vi.fn();

    const subAgentTool = createTool({
      id: 'agent-researcher',
      description: 'Delegate to the researcher agent',
      inputSchema: z.object({ prompt: z.string() }),
      execute: inner,
    });

    const built = new CoreToolBuilder({
      originalTool: subAgentTool,
      options: toolOptions('agent-researcher'),
    }).build();

    // Skipping `Tool.execute`'s validation must not mean skipping validation:
    // the builder validates against the injected schema instead.
    await built.execute!({ prompt: 12345 } as any, { toolCallId: 'call-1', messages: [] } as any);

    expect(inner).not.toHaveBeenCalled();
  });
});
