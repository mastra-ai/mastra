import { TaskPanel as SharedTaskPanel } from '@mastra/playground-ui/domains/chat/transcript';

import { useChatTranscript } from '../context/useChatTranscript';

export function TaskPanel() {
  const { transcript } = useChatTranscript();
  return <SharedTaskPanel tasks={transcript.tasks} />;
}
