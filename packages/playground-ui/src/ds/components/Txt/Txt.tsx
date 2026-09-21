import type { HTMLAttributes, ReactNode, Ref } from 'react';

import type { TextRole } from '@/ds/tokens';
import { cn } from '@/lib/utils';

export interface TxtProps extends HTMLAttributes<HTMLDivElement | HTMLLabelElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'label' | 'div';
  ref?: Ref<HTMLElement>;
  variant?: TextRole;
  tone?: keyof typeof tones;
  font?: 'mono';
  htmlFor?: string;
  className?: string;
  title?: string;
  children?: ReactNode;
}

const fonts = {
  mono: 'font-mono',
};

// One class per role, written out so Tailwind's scanner finds it: size, line height,
// weight and tracking come from the `--text-*` tokens in theme/typography.css, so nothing
// here can drift from a component that writes the same role by hand. Typed against
// `TextRole`, so a role added to the token list has to land here too.
const roles: Record<TextRole, string> = {
  display: 'text-display',
  title: 'text-title',
  heading: 'text-heading',
  subheading: 'text-subheading',
  body: 'text-body',
  label: 'text-label',
  'body-sm': 'text-body-sm',
  column: 'text-column',
  caption: 'text-caption',
  meta: 'text-meta',
};

// Three tones, the same neutral roles every control uses.
const tones = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  faint: 'text-placeholder',
};

export const Txt = ({ as: Root = 'p', className, variant = 'body', tone, font, ref, ...props }: TxtProps) => {
  // Cast needed: `Root` is polymorphic, so TS narrows the expected ref to a single element type.
  return (
    <Root
      ref={ref as never}
      className={cn(roles[variant], tone && tones[tone], font && fonts[font], className)}
      {...props}
    />
  );
};
