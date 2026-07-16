import { Brain } from 'lucide-react';

import { useChatTranscript } from '../../context/useChatTranscript';

const statusItem = 'inline-flex items-center gap-1 text-icon3 [&_svg]:text-icon2';

/** Transient execution telemetry: active OM phase and decode throughput. */
export function RuntimeActivity() {
  const { transcript } = useChatTranscript();
  const { omPhase, tokensPerSec } = transcript;

  return (
    <>
      {omPhase && omPhase !== 'idle' && (
        <span className={statusItem}>
          <Brain size={13} /> {omPhase}
        </span>
      )}
      {(tokensPerSec ?? 0) > 0 && <span className={statusItem}>{tokensPerSec} tok/s</span>}
    </>
  );
}
