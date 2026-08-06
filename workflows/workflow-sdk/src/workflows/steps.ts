import { getWritable } from 'workflow';
import { MASTRA_EVENT_NAMESPACE } from '../constants';
import type { MastraOpRequest, MastraOpResponse } from '../types';
import type { MastraStreamEventLike } from './walker';

/**
 * `"use step"` functions: the host half of the integration.
 *
 * These run in the full Node runtime inside the flow handler, which is where
 * the real Mastra `execute` functions, storage and agents live.
 *
 * The heavy lifting sits behind a dynamic `import()` rather than a top-level
 * one. In workflow mode the compiler erases these bodies and replaces them with
 * durable step proxies, so an import written here never reaches the sandbox
 * bundle. A static `import '../executor.js'` would drag `@mastra/core` — and
 * its Node builtins — into the workflow VM.
 *
 * The dynamic form is necessary but not sufficient: it only defers anything
 * while `../executor` is still a separate module in the built output. The
 * bundler inlines it by default, which hoists the executor's `@mastra/core`
 * imports to the top of this file and puts them out of erasure's reach, so
 * `tsup.config.ts` marks the specifier external to prevent that. Keep the
 * specifier extensionless and keep the two in step if either moves.
 */

/**
 * Runs one Mastra callable (step, condition, sleep resolver) on the host.
 *
 * Mastra step failures come back as a `failed` response instead of a thrown
 * error. Mastra owns retry semantics through `step.retries`, and the walker
 * applies them; letting the error escape would hand retry control to the Workflow SDK
 * runtime instead and double up the attempts.
 */
export async function executeMastraOp(request: MastraOpRequest): Promise<MastraOpResponse> {
  'use step';
  const { runMastraOp } = await import('../executor');
  return runMastraOp(request);
}

// Mastra owns retry policy through `step.retries`, and the walker applies it by
// re-invoking this function. The Workflow SDK retries steps three times by
// default, so leaving that on would multiply the two policies together. It is
// safe to disable here because `runMastraOp` reports Mastra step failures as a
// `failed` response rather than throwing — a rejection out of this function
// means the host itself broke, which retrying would not fix either.
executeMastraOp.maxRetries = 0;

/**
 * Publishes Mastra workflow events onto the run's `mastra:events` stream.
 *
 * Emission is a step rather than a direct write from the workflow because
 * `getWritable()` only yields a live stream inside a step; in workflow mode it
 * returns an inert handle.
 */
export async function emitMastraEvents(_runId: string, events: MastraStreamEventLike[]): Promise<void> {
  'use step';
  if (!events.length) {
    return;
  }
  const writable = getWritable<MastraStreamEventLike>({ namespace: MASTRA_EVENT_NAMESPACE });
  const writer = writable.getWriter();
  try {
    for (const event of events) {
      await writer.write(event);
    }
  } finally {
    writer.releaseLock();
  }
}
