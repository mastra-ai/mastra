import { useEffect, useState } from 'react';

import { useChatRuntime } from '../context/useChatRuntime';
import { useChatTranscript } from '../context/useChatTranscript';
import { omWork } from '../services/om';
import { lineState, runActivity, spokenByStretch } from '../services/run-activity';
import { RunLine } from './RunLine';

/** Long enough for done or error to land, hold, and fade before the line leaves the tree. */
const LINGER_MS = 1500;

/** True while `on`, and for a moment after it turns off — the room an exit needs to play. */
function useLinger(on: boolean): boolean {
  const [linger, setLinger] = useState(false);
  if (on && !linger) setLinger(true);

  useEffect(() => {
    if (on || !linger) return;
    const timer = setTimeout(() => setLinger(false), LINGER_MS);
    return () => clearTimeout(timer);
  }, [on, linger]);

  return on || linger;
}

/**
 * The agent's state for the whole run: what it is doing while it works, a held prompt while it
 * waits on the user, then done or error for a beat before the line fades out.
 */
export function ActivityLine({ stretchLive }: { stretchLive: boolean }) {
  const { busy, transcript } = useChatTranscript();
  const runtime = useChatRuntime();
  const activity = runActivity(transcript.entries);
  const live = busy || activity === 'waiting';
  const shown = useLinger(live);
  if (!shown) return null;

  const state = lineState(activity, busy, Object.values(omWork(runtime)).includes('blocking'));
  if (state === 'writing' || (stretchLive && spokenByStretch(state))) return null;
  return <RunLine state={state} live={live} />;
}
