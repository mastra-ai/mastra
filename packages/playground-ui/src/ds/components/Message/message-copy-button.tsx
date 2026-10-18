import { CopyButton } from '../CopyButton';

export function MessageCopyButton({ text }: { text: string }) {
  return <CopyButton content={text} size="icon-sm" variant="ghost" tooltip="Copy message" showToast={false} />;
}
