import { TaskPanel as SharedTaskPanel } from '@mastra/playground-ui/domains/chat/transcript';

import { useChatTranscript } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/useChatTranscript';

export function TaskPanel() {
  const { transcript } = useChatTranscript();
  return <SharedTaskPanel tasks={transcript.tasks} />;
}
