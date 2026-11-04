import { useState } from 'react';
import type { ReactNode } from 'react';

import { ChatAnnotationsProvider, useChatAnnotations } from '../chat-annotations';
import { ComposerAnnotations } from '../composer-annotations';
import { formatAnnotatedMessage } from '../format-annotated-message';
import { TranscriptAnnotations } from '../transcript-annotations';
import { ChatShell } from '@/ds/components/ChatShell';
import { Composer, ComposerBox, ComposerInput } from '@/ds/components/Composer';
import { Message, MessageActions } from '@/ds/components/Message';

export const REPLY = 'Open rows drop the frame and keep subtle rounded hover.';
export const SECOND = 'Soft rows add faint backgrounds.';

export function AnnotatingChat({
  onSend,
  showReply = true,
  reply = REPLY,
  children,
}: {
  onSend: (message: string) => void;
  showReply?: boolean;
  reply?: string;
  children?: ReactNode;
}) {
  const { takeAnnotations } = useChatAnnotations();
  const [draft, setDraft] = useState('');

  return (
    <ChatShell>
      <div role="region" aria-label="Conversation" tabIndex={0}>
        <ChatShell.Transcript data-testid="transcript">
          <TranscriptAnnotations />
          <Message from="user">Which table style should we use?</Message>
          {showReply && (
            <Message
              from="assistant"
              footer={
                <MessageActions>
                  <span>Model reply footer</span>
                </MessageActions>
              }
            >
              <p>{reply}</p>
              <p>{SECOND}</p>
            </Message>
          )}
        </ChatShell.Transcript>
      </div>
      <Message from="assistant">Outside the transcript</Message>
      <ChatShell.Dock>
        <Composer
          aria-label="Message composer"
          onSubmit={event => {
            event.preventDefault();
            onSend(formatAnnotatedMessage(draft, takeAnnotations()));
            setDraft('');
          }}
        >
          <ComposerBox>
            <ComposerAnnotations />
            <ComposerInput aria-label="Message" value={draft} onChange={event => setDraft(event.target.value)} />
            <button type="submit">Send</button>
          </ComposerBox>
        </Composer>
      </ChatShell.Dock>
      {children}
    </ChatShell>
  );
}

export function ProvidedChat({
  onSend,
  showReply,
  reply,
}: {
  onSend: (message: string) => void;
  showReply: boolean;
  reply?: string;
}) {
  return (
    <ChatAnnotationsProvider>
      <AnnotatingChat onSend={onSend} showReply={showReply} reply={reply} />
    </ChatAnnotationsProvider>
  );
}
