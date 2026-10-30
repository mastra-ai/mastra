import { useChatRuntime } from '../context/useChatRuntime';
import { useChatTranscript } from '../context/useChatTranscript';
import { omWork } from '../services/om';
import { lineState, runActivity, spokenByStretch } from '../services/run-activity';
import { RunLine } from './RunLine';

/**
 * The agent's state for the whole run: what it is doing while it works, a held prompt while it
 * waits on the user, then done or error for a beat before the line fades out.
 */
export function ActivityLine({ stretchLive }: { stretchLive: boolean }) {
  const { busy, transcript } = useChatTranscript();
  const runtime = useChatRuntime();
  const activity = runActivity(transcript.entries);
  const state = lineState(activity, busy, Object.values(omWork(runtime)).includes('blocking'));
  if (state === 'writing' || (stretchLive && spokenByStretch(state))) return null;
  return <RunLine state={state} live={busy || activity === 'waiting'} run={runtime.runsStarted} />;
}
