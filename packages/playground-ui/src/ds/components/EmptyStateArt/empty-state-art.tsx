import { useId } from 'react';
import type { ComponentProps, CSSProperties } from 'react';
import './empty-state-art.css';
import type { SceneHue } from './art/scene-style';
import { sceneByName } from './art/scenes';
import type { EmptyStateArtName } from './art/scenes';
import { trackArtMotion } from './art-motion';
import { cn } from '@/lib/utils';

export type EmptyStateArtState = 'idle' | 'working' | 'failed';
export type EmptyStateArtHue = SceneHue;

const hueColor = {
  purple: 'var(--color-brand-purple)',
  blue: 'var(--color-brand-blue)',
  green: 'var(--color-brand-green)',
  orange: 'var(--color-brand-orange)',
  pink: 'var(--color-brand-pink)',
  yellow: 'var(--color-brand-yellow)',
} satisfies Record<EmptyStateArtHue, string>;

export type EmptyStateArtProps = Omit<ComponentProps<'span'>, 'children'> & {
  name: EmptyStateArtName;
  state?: EmptyStateArtState;
  hue?: EmptyStateArtHue;
};

const OPTICAL_SIZE = 150;

function opticalSize({ width, height }: { width: number; height: number }) {
  const scale = OPTICAL_SIZE / Math.sqrt(width * height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function EmptyStateArt({ name, state = 'idle', hue, className, style, ...props }: EmptyStateArtProps) {
  const id = useId().replace(/[^\w-]/g, '');
  const scene = sceneByName[name];
  const size = opticalSize(scene);
  const artStyle: CSSProperties & { '--art-tint': string } = { ...style, '--art-tint': hueColor[hue ?? scene.hue] };

  return (
    <span
      data-slot="empty-state-art"
      data-state={state}
      ref={trackArtMotion}
      className={cn('block max-w-full shrink-0', className)}
      style={artStyle}
      {...props}
    >
      <svg
        className="art max-w-full"
        viewBox={scene.viewBox}
        width={size.width}
        height={size.height}
        aria-hidden="true"
        data-illustration={name}
      >
        <scene.Scene id={id} />
      </svg>
    </span>
  );
}
