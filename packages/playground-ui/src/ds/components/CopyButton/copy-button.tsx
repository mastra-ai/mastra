import type { ReactNode } from 'react';
import type { ButtonProps, IconButtonSize, TextButtonSize } from '../Button';
import { Button } from '../Button';
import { CopyIcon, CopyLabel, CopyTooltip } from './copy-feedback';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

type CopyButtonBaseProps = {
  content: string;
  className?: string;
  variant?: ButtonProps['variant'];
  disabled?: boolean;
  /** Shown until it's copied. Default: the copy icon. */
  icon?: ReactNode;
  /** @deprecated Copying no longer shows a toast, so this does nothing. */
  copyMessage?: string;
  /** @deprecated Copying no longer shows a toast, so this does nothing. */
  showToast?: boolean;
};

type CopyIconButtonProps = CopyButtonBaseProps & {
  children?: undefined;
  /** What it copies: the button's name and its tooltip. */
  tooltip?: string;
  size?: IconButtonSize;
};

type CopyTextButtonProps = CopyButtonBaseProps & {
  /** The button's label. It reads "Copied" once copied, in the same width. */
  children: string;
  tooltip?: string;
  size?: TextButtonSize;
};

export type CopyButtonProps = CopyIconButtonProps | CopyTextButtonProps;

/** Copies `content`, and says so in place: its icon turns into a checkmark and its tooltip or label into "Copied". */
export function CopyButton(props: CopyButtonProps) {
  const { content, className, variant, disabled, children, icon, tooltip } = props;
  const { status, handleCopy } = useCopyToClipboard({ text: content });
  const buttonProps = { type: 'button', variant, className, disabled, onClick: handleCopy } as const;

  if (children !== undefined) {
    const button = (
      <Button {...buttonProps} size={props.size} icon={<CopyIcon status={status} icon={icon} />}>
        <CopyLabel status={status}>{children}</CopyLabel>
      </Button>
    );
    if (!tooltip) return button;
    return (
      <CopyTooltip status={status} label={tooltip}>
        {button}
      </CopyTooltip>
    );
  }

  const label = tooltip ?? 'Copy to clipboard';
  return (
    <CopyTooltip status={status} label={label}>
      <Button {...buttonProps} size={props.size ?? 'icon-sm'} aria-label={label}>
        <CopyIcon status={status} icon={icon} />
      </Button>
    </CopyTooltip>
  );
}
