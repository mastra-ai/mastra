import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SettingsValueProps = ComponentProps<'span'> & {
  /** Monospaced, with even digits: versions, branches, hashes. */
  mono?: boolean;
};

/** The value as plain text (`Build {version}` included), for the hover title; `undefined` when it holds elements. */
function plainText(children: ReactNode): string | undefined {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (!Array.isArray(children)) return undefined;
  const parts = children.map(plainText);
  if (parts.some(part => part === undefined)) return undefined;
  return parts.join('');
}

/**
 * A value people read but don't change or copy (a name, an email, a sign-in method, a version), on the right of a
 * `SettingsItem` or `SettingsRow`. One line, as wide as the fields beside it; a longer value truncates and shows in
 * full on hover. For a value people copy, use `CopyInput`.
 *
 * @example
 * <SettingsItem title="Email" description="From your sign-in provider.">
 *   <SettingsValue>ada@example.com</SettingsValue>
 * </SettingsItem>
 */
export function SettingsValue({ mono = false, className, title, children, ...props }: SettingsValueProps) {
  return (
    <span
      data-slot="settings-value"
      title={title ?? plainText(children)}
      className={cn(
        'max-w-full min-w-0 truncate text-body-sm text-foreground sm:max-w-55',
        mono && 'font-mono tabular-nums',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
