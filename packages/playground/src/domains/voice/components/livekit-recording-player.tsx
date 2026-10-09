import { Notice } from '@mastra/playground-ui/components/Notice';
import { useState } from 'react';

export function LiveKitRecordingPlayer({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <Notice variant="warning">
        <Notice.Message>
          The audio could not be played. Refresh the recording to get a new playback link.
        </Notice.Message>
      </Notice>
    );
  }
  return (
    <audio
      aria-label="Call recording"
      controls
      preload="metadata"
      src={url}
      className="w-full"
      onError={() => setFailed(true)}
    >
      Your browser does not support audio playback.
    </audio>
  );
}
