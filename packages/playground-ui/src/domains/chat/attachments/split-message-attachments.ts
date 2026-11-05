import { isMcpAppContextText } from '@/utils/mcp-app-context';

interface Part {
  type: string;
  text?: string;
}

export function isMessageAttachment(part: Part) {
  return (
    part.type === 'file' ||
    (part.type === 'text' && /^<attachment name="[^"]*">[\s\S]*<\/attachment>$/.test(part.text ?? ''))
  );
}

/** Context an MCP App attached for the model; never shown to the user. */
const isHiddenPart = (part: Part) => part.type === 'text' && isMcpAppContextText(part.text ?? '');

/** Group sent files without changing the relative order of files or message content. */
export function splitMessageAttachments<T extends Part>(parts: readonly T[]) {
  const attachments = parts.filter(isMessageAttachment);
  const content = parts.filter(part => !isMessageAttachment(part) && !isHiddenPart(part));
  return {
    attachments,
    content: attachments.length > 0 ? content.filter(part => part.type !== 'text' || part.text?.trim()) : content,
  };
}
