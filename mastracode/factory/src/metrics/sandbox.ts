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

function isTimeout(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /time(d)?\s?out/i.test(text);
}

/**
 * Times the provider's part of every real start of `sandbox` (lease and boot, up to the onStart
 * hook), so a slow or failing provider is told apart from slow or failing repository setup.
 * Patches `_start` in place: `start()` and the lazy start before the first command both go through it.
 */
export function instrumentSandboxStart(sandbox: object, provider: string): void {
  if (!factoryMetrics().enabled('sandbox')) return;
  const target = sandbox as StartableSandbox;
  const original = target._start;
  if (typeof original !== 'function') return;
  target._start = async (...args: unknown[]) => {
    const real = target.status !== 'running' && !pendingStarts.has(sandbox);
    if (real) pendingStarts.set(sandbox, { startedAt: performance.now(), provider });
    try {
      return await original.apply(sandbox, args);
    } catch (error) {
      // Still pending: the provider failed before the onStart hook ran. Hook failures are setup
      // failures and are counted on the phase instead.
      if (real && pendingStarts.has(sandbox)) {
        factoryMetrics().count('sandbox', 'mastra_factory_sandbox_start_failures_total', {
          provider,
          cause: isTimeout(error) ? 'timeout' : 'error',
        });
      }
      throw error;
    } finally {
      if (real) pendingStarts.delete(sandbox);
    }
  };
}

/** Called as the sandbox's onStart hook begins: the provider has handed over a running VM. */
export function recordSandboxAcquired(sandbox: object, outcome: string | undefined): void {
  const pending = pendingStarts.get(sandbox);
  if (!pending) return;
  pendingStarts.delete(sandbox);
  factoryMetrics().observe('sandbox', 'mastra_factory_sandbox_start_ms', performance.now() - pending.startedAt, {
    provider: pending.provider,
    outcome: outcome === 'created' || outcome === 'connected' ? outcome : 'unknown',
  });
}
