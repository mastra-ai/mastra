import { useChatRuntime } from '../context/useChatRuntime';

import { useChatTranscript } from '../context/useChatTranscript';
import { omWork } from '../services/om';
import { ActivityLine as SharedActivityLine } from '@/domains/chat/transcript';

export function ActivityLine({ stretchLive }: { stretchLive: boolean }) {
  const { busy, transcript } = useChatTranscript();
  const runtime = useChatRuntime();
  return (
    <SharedActivityLine
      entries={transcript.entries}
      lastEntryBeforeRun={transcript.lastEntryBeforeRun}
      busy={busy}
      runsStarted={runtime.runsStarted}
      memoryBlocking={Object.values(omWork(runtime)).includes('blocking')}
      stretchLive={stretchLive}
    />
  );
}
