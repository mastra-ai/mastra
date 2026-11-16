import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { Sizes } from '@mastra/playground-ui/tokens';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { CSSProperties } from 'react';

type ChatHeaderStyle = CSSProperties & { '--chat-header-top': string; '--chat-header-room': string };

const headerTopPx = 8;

export const chatHeaderRoomPx = Number.parseFloat(Sizes['header-default']) + headerTopPx;

export const chatHeaderStyle: ChatHeaderStyle = {
  '--chat-header-top': `${headerTopPx}px`,
  '--chat-header-room': `${chatHeaderRoomPx}px`,
};

export const headerCapsuleClass = cn(
  raisedSurfaceStyle,
  'pointer-events-auto flex w-fit min-w-0 items-center gap-0.5 rounded-full p-0.5 empty:hidden',
);
