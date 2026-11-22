import type { CSSProperties, ReactNode } from 'react';

export type SceneProps = { id: string };

export type SceneHue = 'purple' | 'blue' | 'green' | 'orange' | 'pink' | 'yellow';

export type Scene = {
  Scene: (props: SceneProps) => ReactNode;
  viewBox: string;
  width: number;
  height: number;
  hue: SceneHue;
};

type SceneStyle = CSSProperties & { [key: `--${string}`]: string };

export const s = (style: SceneStyle): CSSProperties => style;
