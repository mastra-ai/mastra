import type { TextRole } from '@/ds/tokens';
import { cn } from '@/lib/utils';

const roles: Record<TextRole, string> = {
  hero: 'text-hero font-display',
  lead: 'text-lead',
  display: 'text-display',
  title: 'text-title',
  heading: 'text-heading',
  subheading: 'text-subheading',
  body: 'text-body',
  label: 'text-label',
  'card-title': 'text-card-title',
  'card-title-tight': 'text-card-title-tight',
  'card-title-strong': 'text-card-title-strong',
  'body-sm': 'text-body-sm',
  column: 'text-column',
  caption: 'text-caption',
  eyebrow: 'text-eyebrow uppercase',
  meta: 'text-meta',
};

const tones = {
  ink: 'text-foreground',
  muted: 'text-muted-foreground',
  faint: 'text-placeholder',
};

const fonts = {
  body: 'font-body',
  display: 'font-display',
  mono: 'font-mono',
};

export interface TextStyleProps {
  variant?: TextRole;
  tone?: keyof typeof tones;
  font?: keyof typeof fonts;
}

/** Shared by Txt and controls that must keep their native semantics and behavior. */
export function textStyle({ variant, tone, font }: TextStyleProps) {
  return cn(variant && roles[variant], tone && tones[tone], font && fonts[font]);
}
