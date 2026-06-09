import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Agent } from '@mastra/core/agent';
import { Harness as HarnessV1 } from '@mastra/core/harness/v1';
import type { HarnessMode as HarnessModeV1, Session } from '@mastra/core/harness/v1';
import type { PublicSchema } from '@mastra/core/schema';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';

/**
 * Builds a **real** Harness v1 instance backed by LibSQL storage, real Memory,
 * and a mock-model Agent — no `vi.fn()` session stubs, no legacy `new Harness`.
 *
 * Use this in unit/integration tests that assert harness/session behavior so
 * they exercise the genuine v1 code paths (state ownership, persistence, mode/
 * model switching, signal execution) instead of doubles that hide real v1.
 *
 * Returns the harness plus a `cleanup()` that removes the temp LibSQL store.
 * Call `cleanup()` in `afterEach`.
 */
export interface RealV1HarnessOptions<TState> {
  /** Stream factory for the backing mock model. Defaults to an empty text stream. */
  doStream?: () => Promise<{ stream: ReadableStream }>;
  /**
   * Generate result for the backing mock model. v1 `session.signal()` runs the
   * agent via `agent.generate()` (non-streaming), so tests that exercise
   * `signal()` must provide this.
   */
  doGenerate?: unknown;
  /** Tools exposed on the backing agent. */
  tools?: Record<string, unknown>;
  /** Modes to register. Defaults to a single `default` mode. */
  modes?: HarnessModeV1[];
  /** Default mode id. Defaults to the first mode's id. */
  defaultModeId?: string;
  /** Optional state schema for validation. */
  stateSchema?: PublicSchema<TState>;
  /** Initial harness state. */
  initialState?: Partial<TState>;
  /** Stable owner id. Defaults to a fixed test owner. */
  ownerId?: string;
}

export interface RealV1Harness<TState> {
  harness: HarnessV1<HarnessModeV1[], TState>;
  storePath: string;
  cleanup: () => void;
}

function emptyTextStream(): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      controller.close();
    },
  });
}

export function createRealV1Harness<TState = Record<string, unknown>>(
  options: RealV1HarnessOptions<TState> = {},
): RealV1Harness<TState> {
  const tempDir = mkdtempSync(join(tmpdir(), 'mastracode-v1-'));
  const storePath = join(tempDir, 'test.db');

  const storage = new LibSQLStore({ id: 'test-store', url: `file:${storePath}` });
  const memory = new Memory({ storage });

  const agent = new Agent({
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'You are a test agent.',
    model: new MastraLanguageModelV2Mock({
      doStream: options.doStream ?? (async () => ({ stream: emptyTextStream() })),
      ...(options.doGenerate ? { doGenerate: options.doGenerate } : {}),
    }) as never,
    tools: (options.tools ?? {}) as never,
  });

  const modes: HarnessModeV1[] = options.modes ?? [
    { id: 'default', defaultModelId: 'mock-model', description: 'Default' },
  ];
  const defaultModeId = options.defaultModeId ?? modes[0]!.id;

  const harness = new HarnessV1<HarnessModeV1[], TState>({
    ownerId: options.ownerId ?? 'test-owner',
    agent,
    memory,
    modes,
    defaultModeId,
    storage,
    stateSchema: options.stateSchema,
    initialState: options.initialState,
    resolveModel: () =>
      new MastraLanguageModelV2Mock({
        doStream: options.doStream ?? (async () => ({ stream: emptyTextStream() })),
        ...(options.doGenerate ? { doGenerate: options.doGenerate } : {}),
      }) as never,
  });

  return {
    harness,
    storePath,
    cleanup: () => rmSync(tempDir, { force: true, recursive: true }),
  };
}

export type { Session };
