import type { InputProcessor, ProcessInputArgs } from '@mastra/core/processors';
import { getWorkspace } from '../backend';
import { TRADES } from '../data';

function today(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Input processor that injects the tenant ("workspace") context for the call as a system
 * message on every turn.
 *
 * In production the workspace would be resolved from the dialed number via a third-party
 * lookup (e.g. a direct Firebase call); here it is a deterministic in-memory stand-in. Keeping
 * tenant facts — company name, trades offered, and the service area — out of the agent's static
 * instructions lets one agent serve many tenants, and makes the per-call context deterministic
 * rather than something the model has to infer.
 */
export const workspaceContextProcessor: InputProcessor = {
  id: 'workspace-context',
  processInput: async ({ messages, systemMessages }: ProcessInputArgs) => {
    // The dialed number would come from the call metadata; default to the demo tenant.
    const workspace = getWorkspace();
    const trades = workspace.trades.map(t => TRADES[t].label).join(', ');
    const context = [
      `Tenant context for this call (resolved from the dialed number).`,
      `Company: ${workspace.company}.`,
      `Trades offered: ${trades}.`,
      `Service area: ${workspace.serviceAreaLabel}.`,
      `Only promise a roof inspection or site visit after confirming the property's zip code is in the service area with the checkServiceArea tool.`,
      `Today is ${today()}.`,
    ].join(' ');
    systemMessages.push({ role: 'system', content: context });
    return { messages, systemMessages };
  },
};
