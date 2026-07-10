import { Button } from '@mastra/playground-ui/components/Button';
import { SkeletonRows } from '../../../../ui';
import { ArrowDown } from 'lucide-react';

import { useChatSession } from '../../context/ChatSessionProvider';
import { useTranscriptScroll } from '../../hooks/useTranscriptScroll';
import { Transcript } from '../Transcript';
import { EmptyThreadState } from './EmptyThreadState';
import { WorkingIndicator } from './WorkingIndicator';

const transcriptScrollClass =
  'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto scroll-smooth px-3 pb-2 pt-6 md:px-5 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[80ch]';

export function TranscriptPanel() {
  const { transcript, status, showWorkingIndicator, messagesPending } = useChatSession();
  const { threadRef, showScrollDown, scrollToBottom } = useTranscriptScroll(transcript);
  const isPending = messagesPending || status === 'connecting';

  if (transcript.entries.length === 0 && isPending) {
    return (
      <div className={transcriptScrollClass} ref={threadRef}>
        <SkeletonRows label="Loading messages" rows={6} />
      </div>
    );
  }

  const panelClassName =
    transcript.entries.length === 0 ? `${transcriptScrollClass} place-items-center` : transcriptScrollClass;

  return (
    <>
      <div className={panelClassName} ref={threadRef}>
        {transcript.entries.length === 0 && <EmptyThreadState />}
        <Transcript />
        {showWorkingIndicator && <WorkingIndicator />}
      </div>
      {showScrollDown && (
        <Button
          variant="default"
          size="icon-sm"
          className="absolute bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full shadow-md"
          onClick={() => scrollToBottom('smooth')}
          aria-label="Scroll to latest message"
        >
          <ArrowDown size={16} />
        </Button>
      )}
    </>
  );
}
