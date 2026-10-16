import type { ReactNode } from 'react';
import type { Scene } from './weather-theme';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const CLOUD = 'M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 11.1 3.5 3.5 0 0 0 7 18z';

const SCENE_ICONS: Record<Scene, ReactNode> = {
  sunny: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  cloudy: <path d={CLOUD} />,
  rainy: (
    <>
      <path d="M7 15h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 8.1 3.5 3.5 0 0 0 7 15z" />
      <path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" />
    </>
  ),
  stormy: <path d="M13 2 5 13h6l-1 9 8-12h-6z" />,
  snowy: <path d="M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7M9 4l3 2 3-2M9 20l3-2 3 2" />,
  foggy: <path d="M3 8h14M6 12h15M3 16h12M8 20h10" />,
};

export function SceneIcon({ scene }: { scene: Scene }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke}>
      {SCENE_ICONS[scene]}
    </svg>
  );
}

export function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}
