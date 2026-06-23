/**
 * Code Mode — tool factory
 *
 * `createCodeMode(config)` returns the `execute_typescript` tool plus the
 * generated `instructions`. The tool transpiles the model's TypeScript to JS,
 * runs it in a WorkspaceSandbox via the transport, and bridges each
 * `external_*` call back to the real Mastra tool on the host.
 */

import { z } from 'zod/v4';
import type { WorkspaceSandbox } from '../../workspace/sandbox/sandbox';
import { createTool } from '../tool';
import type { Tool } from '../tool';
import { isValidationError } from '../validation';
import { createCodeModeInstructions } from './stub-generator';
import { StdioCodeModeTransport } from './transport';
import type { CodeModeConfig, CodeModeToolDispatcher, CodeModeToolResult, CodeModeTransport } from './types';

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_TOOL_NAME = 'execute_typescript';

const codeModeInputSchema = z.object({
  code: z
    .string()
    .describe(
      'A TypeScript program that orchestrates the available external_* tools and returns a final value. ' +
        'Use Promise.all to batch calls; do arithmetic in JS. End with `return <value>`.',
    ),
});

const codeModeOutputSchema = z.object({
  success: z.boolean(),
  result: z.unknown().optional(),
  logs: z.array(z.string()).optional(),
  error: z
    .object({
      message: z.string(),
      name: z.string().optional(),
      line: z.number().optional(),
    })
    .optional(),
});

/** Result of {@link createCodeMode}: the tool plus its generated instructions. */
export interface CodeModeResult {
  tool: Tool<any, any>;
  instructions: string;
}

/** Resolve the tool key -> tool map keyed by the tool's effective id. */
function indexToolsById(config: CodeModeConfig): Map<string, { execute?: (args: any, ctx: any) => Promise<any> }> {
  const map = new Map();
  for (const [key, tool] of Object.entries(config.tools)) {
    const id = (tool as { id?: string }).id ?? key;
    map.set(id, tool);
  }
  return map;
}

/**
 * Create only the `execute_typescript` tool. Most callers want
 * {@link createCodeMode}, which also returns the matching instructions.
 */
export function createCodeModeTool(
  config: CodeModeConfig,
  transport: CodeModeTransport = new StdioCodeModeTransport(),
) {
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;
  const id = config.id ?? DEFAULT_TOOL_NAME;
  const toolsById = indexToolsById(config);
  const toolIds = [...toolsById.keys()];

  return createTool({
    id,
    description:
      'Execute a TypeScript program that orchestrates the available tools in a sandbox. ' +
      'Prefer this over calling tools one at a time when a task needs multiple tool calls, ' +
      'batching, aggregation, or arithmetic.',
    inputSchema: codeModeInputSchema,
    outputSchema: codeModeOutputSchema,
    execute: async ({ code }, ctx): Promise<CodeModeToolResult> => {
      // Resolve sandbox: explicit config -> workspace from context. There is no
      // implicit fallback: Code Mode runs model-authored code, so the execution
      // boundary must be chosen deliberately. To run locally (host privileges),
      // pass `sandbox: new LocalSandbox()` explicitly.
      const sandbox: WorkspaceSandbox | undefined = config.sandbox ?? ctx?.workspace?.sandbox;
      if (!sandbox) {
        throw new Error(
          'Code Mode requires a sandbox to run model-authored code, but none was configured. ' +
            'Pass one to createCodeMode({ tools, sandbox }), or run the agent in a workspace that provides a sandbox. ' +
            'To execute on the host (host privileges — only for trusted/local use), pass `sandbox: new LocalSandbox()`.',
        );
      }

      // Each external_* call re-enters the real Mastra tool pipeline (validation,
      // request-context checks, tracing) on the host, with the outer tool's context.
      const dispatch: CodeModeToolDispatcher = async (toolId, args) => {
        const tool = toolsById.get(toolId);
        if (!tool?.execute) {
          throw new Error(`Tool "${toolId}" is not available in Code Mode`);
        }
        const result = await tool.execute(args, {
          mastra: ctx?.mastra,
          requestContext: ctx?.requestContext,
          abortSignal: ctx?.abortSignal,
          workspace: ctx?.workspace,
        });
        if (isValidationError(result)) {
          throw new Error(result.message ?? `Invalid input for tool "${toolId}"`);
        }
        return result;
      };

      // The TypeScript program is written to a .ts module by the transport;
      // the sandbox's node strips the type annotations natively at import.
      return ctx.observe.span(`code-mode:${id}`, () =>
        transport.run({
          sandbox,
          program: code,
          toolIds,
          dispatch,
          timeout,
          abortSignal: ctx?.abortSignal,
          onExternalCall: (tool, args) => ctx.observe.log('info', 'code-mode external call', { tool, args }),
          onExternalResult: (tool, durationMs, error) =>
            ctx.observe.log(error ? 'error' : 'info', 'code-mode external result', { tool, durationMs }),
        }),
      );
    },
  }) as unknown as Tool<any, any>;
}

/**
 * Create Code Mode: the `execute_typescript` tool plus generated instructions.
 *
 * @example
 * ```ts
 * const { tool, instructions } = createCodeMode({ tools: { getTopProducts, getProductRatings } });
 * const agent = new Agent({ instructions: ['You are helpful.', instructions], tools: { [tool.id]: tool } });
 * ```
 */
export function createCodeMode(config: CodeModeConfig, transport?: CodeModeTransport): CodeModeResult {
  return {
    tool: createCodeModeTool(config, transport),
    instructions: createCodeModeInstructions(config),
  };
}
