import { TranscriptHistoryLoader as SharedTranscriptHistoryLoader } from '@mastra/playground-ui/domains/chat/transcript';

import { useChatTranscript } from '../context/useChatTranscript';

export function TranscriptHistoryLoader() {
  const { loadMore } = useChatTranscript();
  return <SharedTranscriptHistoryLoader loading={loadMore.isLoading} />;
}
