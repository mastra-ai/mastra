import { useChatTranscript } from '../context/useChatTranscript';

import { TranscriptHistoryLoader as SharedTranscriptHistoryLoader } from '@/domains/chat/transcript';

export function TranscriptHistoryLoader() {
  const { loadMore } = useChatTranscript();
  return <SharedTranscriptHistoryLoader loading={loadMore.isLoading} />;
}
