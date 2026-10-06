import type { CSSProperties } from 'react';
import type { Colors } from '@/ds/tokens/colors';
import './grain-fill.css';

const statusTones = ['warning', 'destructive', 'info', 'success'] as const;

export type GrainFillTone = (typeof statusTones)[number] | keyof typeof Colors;

function isStatusTone(tone: GrainFillTone): tone is (typeof statusTones)[number] {
  return statusTones.some(status => status === tone);
}

export interface GrainFillSize {
  width: number;
  height: number;
}

export interface GrainFillProps extends GrainFillSize {
  tone: GrainFillTone;
  className?: string;
}

interface GrainFillStyle extends CSSProperties {
  '--grain-width': string;
  '--grain-height': string;
  '--grain-ink'?: string;
}

/** A static, decorative gradient. CSS owns the theme; fills share pre-rendered grain masks. */
export function GrainFill({ tone, width, height, className }: GrainFillProps) {
  const statusTone = isStatusTone(tone);
  const style: GrainFillStyle = {
    '--grain-width': `${width}px`,
    '--grain-height': `${height}px`,
  };
  if (!statusTone) {
    // Fixed brand colors use Tailwind's namespace; semantic roles use raw variables.
    const property = tone.startsWith('brand-') ? `--color-${tone}` : `--${tone}`;
    style['--grain-ink'] = `var(${property})`;
  }

  return <span aria-hidden data-grain-tone={statusTone ? tone : 'color'} className={className} style={style} />;
}
