import { useIntakeConfigQuery } from '../../../../hooks/useIntakeConfig';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import { cardLinearProjectId, cardRepositorySlug } from '../boardRepository';

export function useCardRepositorySlug(repositories: LinkedRepositoryPayload[]) {
  const intakeConfig = useIntakeConfigQuery();
  return async (source: string, metadata: Record<string, unknown> | undefined) => {
    const configNeeded = cardLinearProjectId(source, metadata) !== undefined && !intakeConfig.data;
    const config = configNeeded ? (await intakeConfig.refetch()).data : intakeConfig.data;
    return cardRepositorySlug(source, metadata, config, repositories);
  };
}
