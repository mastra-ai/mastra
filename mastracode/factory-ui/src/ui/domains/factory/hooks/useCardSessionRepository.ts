import { useIntakeConfigQuery } from '../../../../hooks/useIntakeConfig';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import { cardLinearProjectId, cardSessionRepository, cardSourceMetadata } from '../boardRepository';
import type { CardSessionRepository } from '../boardRepository';
import type { WorkItem } from '../services/workItems';

/** Where the card's own session can start; undefined while the intake routes that decide it load. */
export function useCardSessionRepository(
  repositories: LinkedRepositoryPayload[],
  item: WorkItem,
): CardSessionRepository | undefined {
  const routedByIntake = cardLinearProjectId(item.source, cardSourceMetadata(item)) !== undefined;
  const intakeConfig = useIntakeConfigQuery(routedByIntake);
  if (routedByIntake && intakeConfig.isPending) return undefined;
  return cardSessionRepository(repositories, item, intakeConfig.data);
}
