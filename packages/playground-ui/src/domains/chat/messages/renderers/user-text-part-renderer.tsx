import type { TextPart } from '@mastra/react/ui';

import type { MessageMetadata } from '../message-metadata';
import { SystemReminderBadge } from '../system-reminder-badge';
import { InMessageAttachment } from './in-message-attachment';
import { MessageText } from './message-text';

// Mirrors the note @mastra/server writes when it routes an attachment to the agent workspace.
const WORKSPACE_ATTACHMENT_NOTE =
  /\[Attachment "([^"]+)" \(([^)]+)\) was uploaded to the workspace at [^\]]+?\. Use workspace tools to read it\.\]/g;

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
  const workspaceAttachments = [...text.matchAll(WORKSPACE_ATTACHMENT_NOTE)];
  if (workspaceAttachments.length > 0) {
    const rest = text.replace(WORKSPACE_ATTACHMENT_NOTE, '').trim();
    return (
      <>
        {workspaceAttachments.map(([note, name, contentType]) => (
          <InMessageAttachment key={note} type="file" name={name} contentType={contentType} />
        ))}
        {rest && <MessageText text={rest} metadata={metadata} />}
      </>
    );
  }
  if (text.includes('<attachment name=')) {
    return <InMessageAttachment type="document" contentType="text/plain" data={text} />;
  }

  return <MessageText text={text} metadata={metadata} />;
};
