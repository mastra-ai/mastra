import type { MetricsCollector } from './metrics.js';
import { factoryMetrics } from './metrics.js';

const PHASES: Record<string, string> = {
  materialize: 'materialize',
  checkout: 'checkout',
  setup: 'setup',
  'setup-marker': 'setup_marker',
  sync: 'sync',
  onStart: 'on_start',
};

/**
 * Maps a `timedPhase` name to the `phase` label. Only session workspace phases count; boot
 * phases (`prepare.*`, `background.*`) don't. The `(…)` argument names a repository or an outcome
 * and is never sent: repository names are unbounded.
 */
export function workspacePhaseLabel(phase: string): string | undefined {
  const match = /^workspace\.([A-Za-z-]+)(?:\(.*\))?$/.exec(phase);
  return match ? PHASES[match[1]!] : undefined;
}

/** Maps a sandbox command `phase` (e.g. `repository clone`, `environment branch fetch`) to the `step` label. */
export function commandStepLabel(phase: string): string {
  if (phase === 'repository clone') return 'clone';
  if (phase === 'setup' || phase === 'teardown') return phase;
  if (phase.endsWith(' probe')) return 'probe';
  if (phase.endsWith(' fetch') || phase.endsWith(' refresh')) return 'fetch';
  if (/(checkout|create|retry)$/.test(phase)) return 'checkout';
  return 'other';
}

/** `timedPhase` hook: records a workspace phase duration. */
export function recordWorkspacePhase(phase: string, ms: number, ok: boolean): void {
  const metrics = factoryMetrics();
  if (!metrics.enabled('sandbox')) return;
  const label = workspacePhaseLabel(phase);
  if (!label) return;
  metrics.observe('sandbox', 'mastra_factory_sandbox_phase_ms', ms, { phase: label, outcome: ok ? 'ok' : 'error' });
}

/** Records one attempt of a sandbox command run during workspace setup. */
export function recordSandboxCommand(phase: string, ms: number, outcome: 'ok' | 'exit' | 'threw'): void {
  factoryMetrics().observe('sandbox', 'mastra_factory_sandbox_command_ms', ms, {
    step: commandStepLabel(phase),
    outcome,
  });
}

interface StartableSandbox {
  status?: string;
  _start?: (...args: unknown[]) => Promise<unknown>;
}

// Sandboxes with a start in flight that hasn't reached their onStart hook yet, with its start time
// and provider. The hook firing marks the end of the provider's part of the start.
const pendingStarts = new WeakMap<object, { startedAt: number; provider: string }>();

// Every start in flight, from the first `_start` call until the onStart hook finishes or the start
// fails. A `Map` (entries always removed when the start settles) so a collector can list them.
interface SessionStart {
  startedAt: number;
  kind: 'first' | 'resume';
  // Whether a caller other than the eager start has had its wait recorded.
  waitRecorded: boolean;
}
const sessionStarts = new Map<object, SessionStart>();

// Sandboxes whose next `_start` call is the eager start, which nobody waits on.
const eagerStarts = new WeakSet<object>();

function isTimeout(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /time(d)?\s?out/i.test(text);
}

/** Marks the next start of `sandbox` as the eager start fired when the workspace resolves. */
export function markEagerSandboxStart(sandbox: object): void {
  if (factoryMetrics().enabled('sandbox')) eagerStarts.add(sandbox);
}

/**
 * Times every real start of `sandbox`:
 * - the provider's part (lease and boot, up to the onStart hook), so a slow or failing provider is
 *   told apart from slow or failing repository setup;
 * - the whole start, up to the end of the onStart hook (`mastra_factory_session_ready_ms`), with
 *   failures included. `kind` is `first` for a session's first sandbox and `resume` for later starts;
 * - how long the first caller other than the eager start waited for it
 *   (`mastra_factory_session_sandbox_wait_ms`): the start-up time someone actually waits through.
 * Patches `_start` in place: `start()`, `ensureRunning()` and the lazy start before the first command
 * all go through it. `hadSandbox` says whether the session already had a sandbox before this instance.
 */
export function instrumentSandboxStart(sandbox: object, provider: string, hadSandbox: boolean): void {
  if (!factoryMetrics().enabled('sandbox')) return;
  const target = sandbox as StartableSandbox;
  const original = target._start;
  if (typeof original !== 'function') return;
  let started = hadSandbox;
  target._start = async (...args: unknown[]) => {
    const eager = eagerStarts.delete(sandbox);
    if (target.status === 'running') return original.apply(sandbox, args);
    const callStartedAt = performance.now();
    let start = sessionStarts.get(sandbox);
    const real = !start;
    if (!start) {
      start = { startedAt: callStartedAt, kind: started ? 'resume' : 'first', waitRecorded: false };
      started = true;
      sessionStarts.set(sandbox, start);
      pendingStarts.set(sandbox, { startedAt: callStartedAt, provider });
    }
    const waits = !eager && !start.waitRecorded;
    if (waits) start.waitRecorded = true;
    const done = (outcome: 'ok' | 'error') => {
      const now = performance.now();
      if (waits) {
        factoryMetrics().observe('sandbox', 'mastra_factory_session_sandbox_wait_ms', now - callStartedAt, {
          kind: start.kind,
          outcome,
        });
      }
      if (real) {
        factoryMetrics().observe('sandbox', 'mastra_factory_session_ready_ms', now - start.startedAt, {
          kind: start.kind,
          outcome,
        });
      }
    };
    try {
      const result = await original.apply(sandbox, args);
      done('ok');
      return result;
    } catch (error) {
      // Still pending: the provider failed before the onStart hook ran. Hook failures are setup
      // failures and are counted on the phase instead.
      if (real && pendingStarts.has(sandbox)) {
        factoryMetrics().count('sandbox', 'mastra_factory_sandbox_start_failures_total', {
          sandbox_provider: provider,
          cause: isTimeout(error) ? 'timeout' : 'error',
        });
      }
      done('error');
      throw error;
    } finally {
      if (real) {
        pendingStarts.delete(sandbox);
        sessionStarts.delete(sandbox);
      }
    }
  };
}

/** Called as the sandbox's onStart hook begins: the provider has handed over a running VM. */
export function recordSandboxAcquired(sandbox: object, outcome: string | undefined): void {
  const pending = pendingStarts.get(sandbox);
  if (!pending) return;
  pendingStarts.delete(sandbox);
  factoryMetrics().observe('sandbox', 'mastra_factory_sandbox_start_ms', performance.now() - pending.startedAt, {
    sandbox_provider: pending.provider,
    outcome: outcome === 'created' || outcome === 'connected' ? outcome : 'unknown',
  });
}

/**
 * Starts in flight and the age of the oldest, sent every interval (0 when none), so a start that hangs
 * shows while it's happening instead of only when it ends. Also shows the group is on while idle.
 */
export function sessionStartsCollector(): MetricsCollector {
  return {
    collect(sink) {
      const now = performance.now();
      let oldest = 0;
      for (const start of sessionStarts.values()) oldest = Math.max(oldest, now - start.startedAt);
      sink.emit('mastra_factory_sessions_starting', sessionStarts.size);
      sink.emit('mastra_factory_session_start_oldest_age_s', oldest / 1000);
    },
  };
}
