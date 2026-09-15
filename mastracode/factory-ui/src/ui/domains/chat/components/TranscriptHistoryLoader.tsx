import { Spinner } from '@mastra/playground-ui/components/Spinner';

import { useChatTranscript } from '../context/useChatTranscript';

export function TranscriptHistoryLoader() {
  const { loadMore } = useChatTranscript();
  if (!loadMore.isLoading) return null;

  return (
    <div className="flex w-full justify-center py-2">
      <Spinner size="sm" className="text-icon3" aria-label="Loading older messages" />
    </div>
  );
}
