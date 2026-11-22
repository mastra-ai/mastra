import type { CSSProperties } from 'react';

import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { Sizes } from '@/ds/tokens';
import { cn } from '@/lib/utils';

type ChatHeaderStyle = CSSProperties & { '--chat-header-top': string; '--chat-header-room': string };

const headerTopPx = 8;

export const sessionHeaderRoomPx = Number.parseFloat(Sizes['header-default']) + headerTopPx;

export const headerStyle: ChatHeaderStyle = {
  '--chat-header-top': `${headerTopPx}px`,
  '--chat-header-room': `${sessionHeaderRoomPx}px`,
};

export const sessionHeaderCapsuleClass = cn(
  raisedSurfaceStyle,
  'pointer-events-auto flex w-fit min-w-0 items-center gap-0.5 rounded-full p-0.5 empty:hidden',
);
