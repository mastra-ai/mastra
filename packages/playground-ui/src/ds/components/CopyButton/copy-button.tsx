import { CopyIcon, CheckIcon } from 'lucide-react';

import { useCopyToClipboard } from '../../../hooks/use-copy-to-clipboard';
import type { ButtonProps, IconButtonSize } from '../Button';
import { Button } from '../Button';

export type CopyButtonProps = {
  content: string;
  copyMessage?: string;
  showToast?: boolean;
  tooltip?: string;
  className?: string;
  size?: IconButtonSize;
  variant?: ButtonProps['variant'];
};

export function CopyButton({
  content,
  copyMessage,
  showToast,
  tooltip = 'Copy to clipboard',
  size = 'icon-sm',
  variant,
  className,
}: CopyButtonProps) {
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: content,
    copyMessage,
    showToast,
  });

  return (
    <Button
      onClick={handleCopy}
      type="button"
      size={size}
      variant={variant}
      className={className}
      tooltip={isCopied ? 'Copied!' : tooltip}
      aria-label={isCopied ? 'Copied!' : tooltip}
    >
      {isCopied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
