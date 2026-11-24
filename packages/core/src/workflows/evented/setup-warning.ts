import { reachesOtherProcesses } from '../../events/reach';
import type { Mastra } from '../../mastra';
import type { WorkflowsStorage } from '../../storage/domains/workflows/base';

const DOCS_URL = 'https://mastra.ai/docs/server/pubsub#evented-workflows-and-agents';

const warnedHosts = new WeakSet<Mastra>();

/**
 * Evented runs spread over several processes need a pubsub that hands a stopped
 * worker's event to another worker, and a store whose step guards let one
 * delivery of a step commit. Logs once per Mastra instance when the pubsub
 * reaches other processes and one of the two is missing.
 *
 * It judges the setup, not how many processes use it: Mastra can't count them.
 * A pubsub that stays inside the process is left alone, since no other process
 * can take part in its runs. `MASTRA_DISABLE_EVENTED_SETUP_WARNING=true`
 * disables it for a shared transport used by one process.
 *
 * The message names no supported pubsub or store. The docs page it links to is
 * the one place that lists them.
 */
export function warnUnsupportedEventedSetup(mastra: Mastra, workflowsStore?: WorkflowsStorage): void {
  if (warnedHosts.has(mastra) || process.env.MASTRA_DISABLE_EVENTED_SETUP_WARNING === 'true') return;
  if (!reachesOtherProcesses(mastra.pubsub)) return;

  const pubsub = mastra.pubsub.__rawBus();
  let missing: string | undefined;
  if (!pubsub.redeliversUnacked) {
    missing = `${pubsub.constructor.name} doesn't redeliver unacknowledged events`;
  } else if (workflowsStore && !workflowsStore.supportsWorkflowStepGuards()) {
    missing = `the workflows store has no step guards`;
  }
  if (!missing) return;

  warnedHosts.add(mastra);
  mastra
    .getLogger()
    ?.warn(
      `Evented workflows and agents aren't supported on several processes with this setup: ${missing}. See ${DOCS_URL}`,
    );
}
