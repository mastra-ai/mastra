import type { ToolsInput } from '@mastra/core/agent';
import { createCodeMode, createCodeModeTool, generateStubs } from '@mastra/core/tools';
import type { CodeModeConfig, CodeModeTransport } from '@mastra/core/tools';

import { createFunctionSearchTool, searchModeInstructions } from './function-search.js';
import type { ToolsResolverContext } from './tools.js';

type ResolvedToolsRecord = Record<string, { id: string; description?: string }>;

/** Options for {@link ToolsResolver.codeMode}: everything `createCodeMode()` takes except `tools`. */
export interface CodeModeOptions extends Omit<CodeModeConfig, 'tools'> {
  /** Transport passed to `createCodeMode()`. Defaults to its stdio transport, which needs a sandbox. */
  transport?: CodeModeTransport;
  /**
   * List only function names in the instructions and give the model a
   * `search_functions` tool that returns the declarations it needs. Saves
   * context when many providers are connected. By default it turns on when
   * declaring every function would take more than about 10k tokens.
   */
  toolSearch?: boolean;
}

/**
 * Connect tools in Code Mode. Pass both halves to an agent; each resolves the
 * current connections per request, like the resolver itself.
 */
export interface ConnectCodeMode {
  /**
   * The code tool (`execute_typescript` by default) plus the tools that must
   * stay direct: tools that need the user's approval and `request_connection`,
   * which pause the agent run. Pass as the agent's `tools`.
   */
  tools(ctx?: ToolsResolverContext): Promise<ResolvedToolsRecord>;
  /**
   * Instructions declaring the functions the program can call. Add to the
   * agent's instructions. Empty when there is nothing to orchestrate.
   */
  instructions(ctx?: ToolsResolverContext): Promise<string>;
}

interface Build {
  tools: ResolvedToolsRecord;
  instructions: string;
}

/**
 * How long one request reuses its build. An agent call resolves its
 * instructions and tools separately; sharing one build keeps the declared
 * functions identical to the ones the program can call. The window is short
 * so a RequestContext reused across calls still picks up connection changes.
 */
const REQUEST_BUILD_MS = 30_000;

/** Declarations above this size (about 10k tokens) switch to tool search unless `toolSearch` says otherwise. */
const SEARCH_THRESHOLD_CHARS = 40_000;

/**
 * Tools that only work as direct agent tools: approval and suspension are
 * handled by the agent loop, and a call from inside a program bypasses it. A
 * per-call approval function counts too, since it cannot be decided up front.
 */
function needsAgentLoop(tool: { id: string }): boolean {
  const candidate = tool as {
    requireApproval?: unknown;
    needsApprovalFn?: unknown;
    suspendSchema?: unknown;
    resumeSchema?: unknown;
  };
  return Boolean(
    candidate.requireApproval || candidate.needsApprovalFn || candidate.suspendSchema || candidate.resumeSchema,
  );
}

export function connectCodeMode(
  resolve: (ctx?: ToolsResolverContext) => Promise<ResolvedToolsRecord>,
  options: CodeModeOptions = {},
): ConnectCodeMode {
  const { transport, toolSearch, ...config } = options;
  const builds = new WeakMap<object, { build: Promise<Build>; startedAt: number }>();

  const build = async (ctx?: ToolsResolverContext): Promise<Build> => {
    const direct: ResolvedToolsRecord = {};
    const orchestrated: ResolvedToolsRecord = {};
    for (const [key, tool] of Object.entries(await resolve(ctx))) {
      (needsAgentLoop(tool) ? direct : orchestrated)[key] = tool;
    }
    if (Object.keys(orchestrated).length === 0) return { tools: direct, instructions: '' };
    const stubs = generateStubs(orchestrated as ToolsInput);
    const search =
      toolSearch ?? stubs.reduce((size, stub) => size + stub.declaration.length, 0) > SEARCH_THRESHOLD_CHARS;
    if (!search) {
      const codeMode = createCodeMode({ ...config, tools: orchestrated as ToolsInput }, transport);
      return { tools: { ...direct, [codeMode.tool.id]: codeMode.tool }, instructions: codeMode.instructions };
    }
    // Every function stays callable from the program; only the declarations
    // move out of the instructions and behind the search tool.
    const codeTool = createCodeModeTool({ ...config, tools: orchestrated as ToolsInput }, transport);
    const searchTool = createFunctionSearchTool(orchestrated, stubs, codeTool.id);
    return {
      tools: { ...direct, [codeTool.id]: codeTool, [searchTool.id]: searchTool },
      instructions: searchModeInstructions(stubs, codeTool.id),
    };
  };

  const buildFor = (ctx?: ToolsResolverContext): Promise<Build> => {
    const key = ctx?.requestContext;
    if (typeof key !== 'object' || key === null) return build(ctx);
    const cached = builds.get(key);
    if (cached && Date.now() - cached.startedAt < REQUEST_BUILD_MS) return cached.build;
    const entry = { build: build(ctx), startedAt: Date.now() };
    builds.set(key, entry);
    // A failed build is not reused: the next resolution retries.
    entry.build.catch(() => {
      if (builds.get(key) === entry) builds.delete(key);
    });
    return entry.build;
  };

  return {
    tools: async ctx => (await buildFor(ctx)).tools,
    instructions: async ctx => (await buildFor(ctx)).instructions,
  };
}
