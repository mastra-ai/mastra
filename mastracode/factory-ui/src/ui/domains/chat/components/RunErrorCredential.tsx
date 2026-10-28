import { Txt } from '@mastra/playground-ui/components/Txt';

import { useChatTranscript } from '../context/useChatTranscript';
import { useModelCredential } from '../hooks/useModelCredential';
import { HolderBadge } from './StatusLine/ModelCredential';

/** Names the credential a retry would run on; only the latest failure, since an older one may predate a credential change. */
export function RunErrorCredential({ entryId, modelId }: { entryId: string; modelId: string }) {
  const transcript = useChatTranscript();
  const modelCredential = useModelCredential(modelId);
  if (!modelCredential || transcript.transcript.entries.at(-1)?.id !== entryId) return null;
  return (
    <Txt variant="body-sm" tone="muted" className="flex items-center gap-1.5">
      <HolderBadge holder={modelCredential.holder} />
      Runs on {modelCredential.credential} · {modelCredential.holderDescription}
    </Txt>
  );
}
