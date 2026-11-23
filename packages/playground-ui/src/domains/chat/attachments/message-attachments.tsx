import type { MessageFactoryPart } from '@mastra/react/ui';
import { UserFilePartRenderer } from '../messages/renderers/user-file-part-renderer';
import { UserTextPartRenderer } from '../messages/renderers/user-text-part-renderer';

export function MessageAttachments({ parts }: { parts: readonly MessageFactoryPart[] }) {
  if (parts.length === 0) return null;
  return (
    <div role="group" aria-label="Sent attachments" className="flex max-w-full min-w-0 flex-wrap justify-end gap-2">
      {parts.map((part, index) => (
        <div key={index} className="max-w-full min-w-0">
          {part.type === 'file' && <UserFilePartRenderer part={part} />}
          {part.type === 'text' && <UserTextPartRenderer part={part} />}
        </div>
      ))}
    </div>
  );
}
