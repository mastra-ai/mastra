import type { AgentControllerEvent } from '@mastra/core/agent-controller';

import type { FactoryBoardEngine, FactoryRunEndedBinding } from '../board-engine/engine.js';
import { boardForWorkItem } from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import { pendingPhaseOutcome } from '../boards/phase-outcomes.js';
import { toBoardSource } from '../boards/project-boards.js';
import type { ProjectBoardSource } from '../boards/project-boards.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { FactoryRuleRejectedError } from './dispatch-errors.js';

export interface PhaseOutcomeMoveDeps {
  storage: Pick<WorkItemsStorage, 'get'>;
  boards: BoardRegistry | ProjectBoardSource;
  boardEngine: Pick<FactoryBoardEngine, 'requestMove'>;
}

/**
 * Moves the card by the outcome its session reported on the phase it still sits in: sessions say
 * how a phase ended, and only the board engine moves the card. Called once the session's run
 * ended. False when the card holds no outcome for its current phase. A refusal throws a
 * {@link FactoryRuleRejectedError}, settled unless the card kept changing under the request.
 *
 * Every caller asks under the same ingress for one report, so a run end seen twice (by the
 * dispatcher watching the run and by the session itself) asks once and gets one verdict.
 */
export async function applyPhaseOutcome(deps: PhaseOutcomeMoveDeps, binding: FactoryRunEndedBinding): Promise<boolean> {
  for (let attempt = 1; ; attempt++) {
    const item = await deps.storage.get({ orgId: binding.orgId, id: binding.workItemId });
    if (!item) return false;
    const board = boardForWorkItem(item);
    const definition = (await toBoardSource(deps.boards).load(binding)).get(board);
    const pending = definition ? pendingPhaseOutcome(definition, item) : undefined;
    if (!pending) return false;
    const result = await deps.boardEngine.requestMove({
      orgId: binding.orgId,
      factoryProjectId: binding.factoryProjectId,
      workItemId: item.id,
      board,
      stage: pending.to,
      expectedRevision: item.revision,
      actor: { type: 'agent', bindingId: binding.id, role: binding.role },
      ingress: { type: 'agent', identity: `${binding.id}:outcome:${item.stages[0]}:${pending.at}` },
      cause: `${pending.label}: ${pending.reason}`,
    });
    if (result.status === 'accepted') return true;
    // The card changed under the request; read it again, and apply what it holds now.
    if (result.code === 'stale' && attempt < 3) continue;
    throw new FactoryRuleRejectedError(
      result.code,
      `The board engine refused outcome ${pending.outcome} (${pending.label}): ${result.reason}`,
      result.code !== 'stale',
    );
  }
}

type RunEndSession = {
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
};

/**
 * Tells the board engine whenever a run of a bound session ends, however the run started: a plan
 * approved hours after the dispatcher stopped watching its run still ends its phase when the
 * resumed run ends.
 */
export function observeSessionPhaseOutcome(
  session: RunEndSession,
  options: {
    binding: () => Promise<FactoryRunEndedBinding | null>;
    boardEngine: () => Pick<FactoryBoardEngine, 'requestMove' | 'runEnded'> | undefined;
  },
): () => void {
  return session.subscribe(event => {
    if (event.type !== 'agent_end' || event.reason !== 'complete') return;
    void (async () => {
      const boardEngine = options.boardEngine();
      if (!boardEngine) return;
      const binding = await options.binding();
      if (binding) await boardEngine.runEnded(binding, boardEngine);
    })().catch(error => {
      console.warn('[Factory] Unable to apply the outcome a session reported.', error);
    });
  });
}
