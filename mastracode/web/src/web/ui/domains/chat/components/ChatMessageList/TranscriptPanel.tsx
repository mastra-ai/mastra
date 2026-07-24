import { Button } from '@mastra/playground-ui/components/Button';
import { ArrowDown, Loader2 } from 'lucide-react';

import { useChatConnection } from '../../context/useChatConnection';
import { useChatTranscript } from '../../context/useChatTranscript';
import { useTranscriptScroll } from '../../hooks/useTranscriptScroll';
import { Transcript } from '../Transcript';
import { EmptyThreadState } from './EmptyThreadState';
import { WorkingIndicator } from './WorkingIndicator';

const transcriptScrollClass =
  'flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-3 pb-2 pt-6 transition-[padding-right] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] md:px-5 lg:in-data-[panel-open=true]:pr-[calc(var(--chat-right-panel-width)+0.5rem)] motion-reduce:transition-none in-data-[panel-gesture=active]:transition-none [&>*]:mx-auto [&>*]:w-full [&>*]:min-w-0 [&>*]:max-w-[80ch]';

export function TranscriptPanel() {
  const { transcript, showWorkingIndicator, loadMore } = useChatTranscript();
  const { threadId } = useChatConnection();
  const { threadRef, showScrollDown, scrollToBottom } = useTranscriptScroll(transcript, threadId, loadMore);

  const panelClassName =
    transcript.entries.length === 0 ? `${transcriptScrollClass} place-items-center` : transcriptScrollClass;

  return (
    <>
      <div className={panelClassName} ref={threadRef}>
        {loadMore.isLoading && (
          <div className="flex w-full justify-center py-2 text-icon3" aria-live="polite">
            <Loader2 size={16} className="animate-spin" />
            <span className="sr-only">Loading older messages</span>
          </div>
        )}
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
          aria-label="Jump to latest message"
        >
          <ArrowDown size={18} />
        </Button>
      )}
    </>
  );
}
