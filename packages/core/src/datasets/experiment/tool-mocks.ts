import { deepEqual } from '../../utils';

/**
 * A single static tool mock authored on a dataset item.
 *
 * v1 is output-only: when matched, `output` is served to the agent in place of
 * executing the real tool. Error mocks are intentionally not supported in v1
 * (the agent `beforeToolCall` hook can only short-circuit with an output).
 */
export interface ItemToolMock {
  /** Name of the tool this mock applies to. */
  toolName: string;
  /**
   * Arguments to strict-match against the agent's tool call.
   * Compared with deep equality: object key order ignored, array order
   * significant, no type coercion.
   */
  args: Record<string, unknown>;
  /** Output served to the agent when this mock is matched and consumed. */
  output: unknown;
}

/** Deterministic failure codes surfaced via `ExecutionResult.error.code`. */
export const TOOL_MOCK_MISMATCH = 'TOOL_MOCK_MISMATCH';
export const TOOL_MOCK_EXHAUSTED = 'TOOL_MOCK_EXHAUSTED';

export type ToolMockFailureCode = typeof TOOL_MOCK_MISMATCH | typeof TOOL_MOCK_EXHAUSTED;

/** Diagnostic receipt produced for a single item run. Persisted on experiment results. */
export interface ToolMockReport {
  /** Mocks that were matched and served, in consumption order. */
  served: { mockIndex: number; toolName: string; args: unknown }[];
  /** Mocks declared on the item that the agent never consumed (report-only — does NOT fail the item). */
  unconsumed: { mockIndex: number; toolName: string; args: unknown }[];
  /** Unmocked tools that ran live — flags that the item was not fully deterministic. */
  liveCalls: { toolName: string; args: unknown }[];
  /** Present when a mocked tool was mis-called and the item failed. */
  failure?: { code: ToolMockFailureCode; toolName: string; args: unknown };
}

/** Result of attempting to resolve a single tool call against the item's mocks. */
export type ToolMockResolution =
  | { kind: 'serve'; output: unknown }
  | { kind: 'live' }
  | { kind: 'fail'; code: ToolMockFailureCode };

interface MockEntry {
  mockIndex: number;
  toolName: string;
  args: Record<string, unknown>;
  output: unknown;
  consumed: boolean;
}

/**
 * Per-item mock matcher. Built fresh for each item run; consumption is tracked
 * in local state so repeated `(toolName, args)` mocks are served top-to-bottom.
 *
 * Tool execution must be forced sequential while an item has mocks so that
 * ordered consumption is deterministic (the matcher itself is order-sensitive).
 */
export class ToolMockMatcher {
  readonly #entries: MockEntry[];
  readonly #served: ToolMockReport['served'] = [];
  readonly #liveCalls: ToolMockReport['liveCalls'] = [];
  #failure: ToolMockReport['failure'];

  constructor(mocks: ItemToolMock[] | undefined) {
    this.#entries = (mocks ?? []).map((mock, mockIndex) => ({
      mockIndex,
      toolName: mock.toolName,
      args: mock.args,
      output: mock.output,
      consumed: false,
    }));
  }

  /** True when the item declares at least one mock (tool execution should run sequentially). */
  get hasMocks(): boolean {
    return this.#entries.length > 0;
  }

  /**
   * Resolve a single tool call:
   * - no mock for this tool → `live`
   * - unconsumed mock with matching args → `serve`
   * - tool is mocked but args don't match an unconsumed entry → `fail`
   *   (`TOOL_MOCK_EXHAUSTED` if args matched but all consumed, else `TOOL_MOCK_MISMATCH`)
   */
  resolve(toolName: string, args: unknown): ToolMockResolution {
    const candidates = this.#entries.filter(entry => entry.toolName === toolName);

    if (candidates.length === 0) {
      this.#liveCalls.push({ toolName, args });
      return { kind: 'live' };
    }

    const next = candidates.find(entry => !entry.consumed && deepEqual(entry.args, args));
    if (next) {
      next.consumed = true;
      this.#served.push({ mockIndex: next.mockIndex, toolName, args });
      return { kind: 'serve', output: next.output };
    }

    const argsMatchedButConsumed = candidates.some(entry => deepEqual(entry.args, args));
    const code: ToolMockFailureCode = argsMatchedButConsumed ? TOOL_MOCK_EXHAUSTED : TOOL_MOCK_MISMATCH;
    // Record only the first failure — the item fails on it and stops.
    this.#failure ??= { code, toolName, args };
    return { kind: 'fail', code };
  }

  /** Build the diagnostic report for this item run. */
  report(): ToolMockReport {
    const unconsumed = this.#entries
      .filter(entry => !entry.consumed)
      .map(entry => ({ mockIndex: entry.mockIndex, toolName: entry.toolName, args: entry.args }));

    return {
      served: this.#served,
      unconsumed,
      liveCalls: this.#liveCalls,
      ...(this.#failure ? { failure: this.#failure } : {}),
    };
  }
}
