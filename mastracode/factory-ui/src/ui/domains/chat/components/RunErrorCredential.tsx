import { Txt } from '@mastra/playground-ui/components/Txt';

import { useChatModels } from '../context/useChatModels';
import { useChatTranscript } from '../context/useChatTranscript';
import { useModelCredential } from '../hooks/useModelCredential';
import { HolderBadge } from './StatusLine/ModelCredential';

/** Only the latest failure, on the model still active: older cards may predate a credential change. */
export function RunErrorCredential({ entryId, modelId }: { entryId: string; modelId: string }) {
  const transcript = useChatTranscript();
  const { activeModelId } = useChatModels();
  const retriesFailedModel = activeModelId === modelId || activeModelId?.endsWith(`/${modelId}`);
  const modelCredential = useModelCredential(retriesFailedModel ? activeModelId : undefined);
  if (!modelCredential || transcript.transcript.entries.at(-1)?.id !== entryId) return null;
  return (
    <Txt variant="body-sm" tone="muted" className="flex items-center gap-1.5">
      <HolderBadge holder={modelCredential.holder} />
      Runs on {modelCredential.credential} · {modelCredential.holderDescription}
    </Txt>
  );
}
