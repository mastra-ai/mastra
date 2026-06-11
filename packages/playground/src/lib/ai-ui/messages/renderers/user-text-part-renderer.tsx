import type { TextPart } from '@mastra/react';

import type { MessageMetadata } from '../message-metadata';
import { SystemReminderBadge } from '../system-reminder-badge';
import { InMessageAttachment } from './in-message-attachment';
import { MessageText } from './message-text';

export interface UserTextPartRendererProps {
  part: TextPart;
  metadata?: MessageMetadata;
}

/**
 * Renders a user `MessageFactory` `Text` slot. System-reminder text and inline
 * `<attachment name=...>` text get dedicated badges/previews; everything else
 * renders as markdown.
 */
export const UserTextPartRenderer = ({ part, metadata }: UserTextPartRendererProps) => {
  const text = part.text ?? '';

  if (text.trimStart().startsWith('<system-reminder')) {
    return <SystemReminderBadge text={text} />;
  }
  if (text.includes('<attachment name=')) {
    return <InMessageAttachment type="document" contentType="text/plain" data={text} />;
  }

  return <MessageText text={text} metadata={metadata} />;
};
