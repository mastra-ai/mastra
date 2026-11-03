import { Txt } from '@mastra/playground-ui/components/Txt';

import { useAvailableModelsQuery } from '../../../../hooks/useAvailableModels';
import { useChatModelScope } from '../context/useChatModelScope';
import { useChatModels } from '../context/useChatModels';
import { useChatTranscript } from '../context/useChatTranscript';
import { useModelCredential } from '../hooks/useModelCredential';
import { HolderBadge } from './StatusLine/ModelCredential';

/**
 * Only the latest failure, while the session is still on the failed model: older cards may predate a
 * credential change. A failure names its model without the provider, so a name two providers share stays unattributed.
 */
export function RunErrorCredential({ entryId, modelId }: { entryId: string; modelId: string }) {
  const transcript = useChatTranscript();
  const { activeModelId } = useChatModels();
  const { catalogTarget } = useChatModelScope();
  const { data: models } = useAvailableModelsQuery(catalogTarget);
  const failedModels = models?.filter(
    model => model.id === modelId || model.id.slice(model.id.indexOf('/') + 1) === modelId,
  );
  const failedModelId = failedModels?.length === 1 ? failedModels[0]?.id : undefined;
  const modelCredential = useModelCredential(failedModelId === activeModelId ? failedModelId : undefined);
  if (!modelCredential || transcript.transcript.entries.at(-1)?.id !== entryId) return null;
  return (
    <Txt variant="body-sm" tone="muted" className="flex items-center gap-1.5">
      <HolderBadge holder={modelCredential.holder} />
      Runs on {modelCredential.credential} · {modelCredential.holderDescription}
    </Txt>
  );
}
