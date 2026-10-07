import { useIntakeConfigQuery } from '../../../../hooks/useIntakeConfig';
import { cardLinearProjectId, cardRepositorySlug } from '../boardRepository';

export function useCardRepositorySlug() {
  const intakeConfig = useIntakeConfigQuery();
  return async (source: string, metadata: Record<string, unknown> | undefined) => {
    const configNeeded = cardLinearProjectId(source, metadata) !== undefined && !intakeConfig.data;
    const config = configNeeded ? (await intakeConfig.refetch()).data : intakeConfig.data;
    return cardRepositorySlug(source, metadata, config);
  };
}
