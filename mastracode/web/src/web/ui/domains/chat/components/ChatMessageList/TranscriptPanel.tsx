import { Button } from '@mastra/playground-ui/components/Button';
import { ArrowDown } from 'lucide-react';

import { useChatConnection } from '../../context/useChatConnection';
import { useChatTranscript } from '../../context/useChatTranscript';
import { useTranscriptScroll } from '../../hooks/useTranscriptScroll';
import { Transcript } from '../Transcript';
import { EmptyThreadState } from './EmptyThreadState';
import { WorkingIndicator } from './WorkingIndicator';

const transcriptScrollClass =
  'flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-2 pt-6 md:px-5 [&>*]:mx-auto [&>*]:w-full [&>*]:min-w-0 [&>*]:max-w-[80ch]';

export function TranscriptPanel() {
  const { messages, notices, notifications, notificationSummaries, prompts, subagents, pending, showWorkingIndicator } =
    useChatTranscript();
  const { threadId } = useChatConnection();
  const { threadRef, showScrollDown, scrollToBottom } = useTranscriptScroll(messages, pending, threadId);
  const isEmpty =
    messages.length + notices.length + notifications.length + notificationSummaries.length + prompts.length + subagents.length ===
    0;
  const panelClassName = isEmpty ? `${transcriptScrollClass} place-items-center` : transcriptScrollClass;

  return (
    <>
      <div className={panelClassName} ref={threadRef}>
        {isEmpty && <EmptyThreadState />}
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
