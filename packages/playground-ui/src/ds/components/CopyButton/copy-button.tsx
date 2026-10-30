import { CopyIcon, CheckIcon } from 'lucide-react';

import { Icon } from '../../icons/Icon';
import type { IconSize } from '../../icons/Icon';
import type { ButtonProps, IconButtonSize } from '../Button';
import { Button } from '../Button';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

export type CopyButtonProps = {
  content: string;
  copyMessage?: string;
  showToast?: boolean;
  tooltip?: string;
  className?: string;
  size?: IconButtonSize;
  /** A glyph smaller than the button's own rung, for a copy control set beside meta-size text. */
  iconSize?: IconSize;
  variant?: ButtonProps['variant'];
};

export function CopyButton({
  content,
  copyMessage,
  showToast,
  tooltip = 'Copy to clipboard',
  size = 'icon-sm',
  iconSize,
  variant,
  className,
}: CopyButtonProps) {
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: content,
    copyMessage,
    showToast,
  });

  const glyph = isCopied ? <CheckIcon /> : <CopyIcon />;

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
      {iconSize ? <Icon size={iconSize}>{glyph}</Icon> : glyph}
    </Button>
  );
}
