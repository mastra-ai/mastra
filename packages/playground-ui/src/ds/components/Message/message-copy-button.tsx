import { CopyButton } from '../CopyButton';

export function MessageCopyButton({ text }: { text: string }) {
  return <CopyButton content={text} size="icon-xs" variant="ghost" tooltip="Copy message" showToast={false} />;
}
