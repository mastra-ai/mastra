/**
 * MastraCode Experiment Lifecycle
 *
 * Implements SandboxExperimentLifecycle for MastraCode.
 * Each item gets a fresh Harness with its own workspace, memory, and configuration.
 */

import type {
  SandboxExperimentLifecycle,
  SandboxHandle,
  WorkspaceSnapshot,
} from '@mastra/core/datasets';
import { materializeWorkspace, destroyWorkspace, seedThreadMemory } from '@mastra/core/datasets';

import type { MastraCodeExperimentItem, MastraCodeExperimentConfig } from './types';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Handle
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface MastraCodeSandboxHandle extends SandboxHandle {
  harness: unknown; // Typed loosely to avoid circular dep; cast at use site
  unsubscribe?: () => void;
  workspaceSnapshot?: WorkspaceSnapshot;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Lifecycle
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a MastraCode experiment lifecycle.
 *
 * @param experimentConfig - Config with overrides (model, mode, etc.)
 * @returns Lifecycle hooks for runSandboxExperiment
 *
 * @example
 * ```typescript
 * const lifecycle = createMastraCodeLifecycle({ modelOverride: 'openai/gpt-5.2-codex' });
 * const summary = await runSandboxExperiment(mastra, {
 *   items: myItems,
 *   lifecycle,
 *   scorers: [outcomeScorer],
 * });
 * ```
 */
export function createMastraCodeLifecycle(
  experimentConfig?: Pick<MastraCodeExperimentConfig, 'modelOverride' | 'modeOverride' | 'replayMemory'>,
): SandboxExperimentLifecycle<MastraCodeExperimentItem, MastraCodeExperimentOutput> {
  const { modelOverride, modeOverride, replayMemory = true } = experimentConfig ?? {};

  return {
    async setup(item, ctx) {
      const { createMastraCode } = await import('../../index');

      // 1. Materialize workspace
      let workspacePath: string | undefined;
      if (item.workspace) {
        workspacePath = await materializeWorkspace(item.workspace);
      }

      const env = item.environment;
      const effectiveMode = modeOverride ?? env.mode;
      const projectPath = workspacePath ?? env.harnessState.projectPath ?? process.cwd();

      // 2. Build initial state from the experiment item's captured state
      const initialState: Record<string, unknown> = {
        projectPath,
        projectName: env.harnessState.projectName ?? 'experiment',
        gitBranch: env.harnessState.gitBranch,
        yolo: env.harnessState.yolo ?? true, // Default to yolo for experiments
        smartEditing: env.harnessState.smartEditing ?? true,
        thinkingLevel: env.harnessState.thinkingLevel ?? 'off',
        omScope: env.harnessState.omScope ?? 'thread',
        activePlan: env.harnessState.activePlan ?? null,
      };

      if (env.harnessState.permissionRules) {
        initialState.permissionRules = env.harnessState.permissionRules;
      }

      // Apply model override if specified
      if (modelOverride) {
        initialState.currentModelId = modelOverride;
      } else if (env.modelId) {
        initialState.currentModelId = env.modelId;
      }

      // 3. Create a fresh Harness for this item
      let harness: HarnessLike | undefined;
      try {
        const created = await createMastraCode({
          cwd: projectPath,
          initialState,
          omScope: (initialState.omScope as 'thread' | 'resource') ?? 'thread',
          // Disable interactive features for experiments
          disableHooks: true,
          disableMcp: true,
        });
        harness = created.harness as unknown as HarnessLike;

        // Check cancellation before expensive init
        ctx.signal?.throwIfAborted();

        // Initialize the harness
        await harness.init();
      } catch (err) {
        // Clean up workspace if harness setup fails
        if (harness) {
          try { await harness.destroy(); } catch { /* ignore */ }
        }
        if (workspacePath) {
          await destroyWorkspace(workspacePath, item.workspace);
        }
        throw err;
      }

      // Post-init steps wrapped so we can clean up harness + workspace on failure
      try {
        // Switch to the correct mode
        if (effectiveMode !== 'build') {
          harness.switchMode({ modeId: effectiveMode });
        }

        // 4. Seed memory if provided and replay is enabled
        let threadId: string | undefined;
        let resourceId: string | undefined;

        if (replayMemory && item.memory?.messages && item.memory.messages.length > 0) {
          const storage = harness.getMastra()?.getStorage();
          if (storage) {
            const memoryStorage = await storage.getStore('memory');
            if (memoryStorage) {
              // getStore returns unknown; seedThreadMemory requires MemoryStorage.
              // The cast is safe because we know 'memory' domain yields MemoryStorage.
              const result = await seedThreadMemory(memoryStorage as Parameters<typeof seedThreadMemory>[0], item.memory.messages);
              threadId = result.threadId;
              resourceId = result.resourceId;
            }
          }
        }

        return {
          workspacePath,
          threadId,
          resourceId,
          harness,
          workspaceSnapshot: item.workspace,
        } satisfies MastraCodeSandboxHandle;
      } catch (err) {
        try { await harness.destroy(); } catch { /* ignore */ }
        if (workspacePath) {
          await destroyWorkspace(workspacePath, item.workspace);
        }
        throw err;
      }
    },

    async execute(item, handle, ctx) {
      const h = handle as MastraCodeSandboxHandle;
      const harness = h.harness as HarnessLike;
      const { threadId } = h;

      // If we seeded memory, switch to that thread
      if (threadId) {
        await harness.switchThread({ threadId });
      }

      // Collect the agent's response
      const output: MastraCodeExperimentOutput = {
        messages: [],
        toolCalls: [],
        errors: [],
        startedAt: Date.now(),
        completedAt: 0,
      };

      // Subscribe to harness events to capture tool calls
      const unsubscribe = harness.subscribe((event: { type: string; [key: string]: unknown }) => {
        if (event.type === 'tool_call') {
          output.toolCalls.push({
            toolName: (event.toolName as string) ?? 'unknown',
            args: event.args,
            result: event.result,
            error: event.error as string | undefined,
          });
        }
      });

      try {
        // Check cancellation before sending
        ctx.signal?.throwIfAborted();

        // Send the user's message
        await harness.sendMessage({
          content: item.input.userMessage,
          files: item.input.files,
        });
      } catch (err) {
        output.errors.push(err instanceof Error ? err.message : String(err));
      } finally {
        unsubscribe();
      }

      output.completedAt = Date.now();

      // Collect final messages from thread
      const storage = harness.getMastra()?.getStorage();
      if (storage) {
        const memoryStorage = (await storage.getStore('memory')) as MemoryStorageLike | undefined;
        const currentThreadId = harness.getCurrentThreadId();
        if (memoryStorage && currentThreadId) {
          try {
            const result = await memoryStorage.listMessages({ threadId: currentThreadId, perPage: false as const });
            output.messages = result.messages;
          } catch {
            // Thread might not exist yet if sendMessage failed early
          }
        }
      }

      return output;
    },

    async teardown(handle, result) {
      const { workspacePath, workspaceSnapshot, harness } = handle as MastraCodeSandboxHandle;

      // Destroy harness resources
      try {
        const h = harness as HarnessLike;
        await h.destroy();
      } catch {
        // Ignore cleanup errors
      }

      // Clean up workspace (unless it failed and we want to keep for debugging)
      if (workspacePath) {
        await destroyWorkspace(workspacePath, workspaceSnapshot);
      }
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Harness interface (minimal shape to avoid importing the full generic)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface HarnessLike {
  init(): Promise<void>;
  destroy(): Promise<void>;
  switchMode(opts: { modeId: string }): void;
  switchThread(opts: { threadId: string }): Promise<void>;
  sendMessage(opts: { content: string; files?: Array<{ data: string; mediaType: string; filename?: string }> }): Promise<void>;
  subscribe(listener: (event: { type: string; [key: string]: unknown }) => void): () => void;
  getCurrentThreadId(): string | null;
  getMastra(): { getStorage(): { getStore(name: string): Promise<unknown> } | undefined } | undefined;
}

interface MemoryStorageLike {
  listMessages(args: { threadId: string; perPage?: number | false }): Promise<{ messages: unknown[] }>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Output types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** What the experiment execution produces — passed to scorers. */
export interface MastraCodeExperimentOutput {
  /** All messages from the thread after execution. */
  messages: unknown[];
  /** Tool calls made during execution. */
  toolCalls: ToolCallRecord[];
  /** Errors encountered during execution. */
  errors: string[];
  /** Start timestamp (epoch ms). */
  startedAt: number;
  /** End timestamp (epoch ms). */
  completedAt: number;
}

/** Record of a single tool call. */
export interface ToolCallRecord {
  toolName: string;
  args?: unknown;
  result?: unknown;
  error?: string;
}
