import { Sizes } from '@mastra/playground-ui/tokens';
import type { CSSProperties } from 'react';

type ChatHeaderStyle = CSSProperties & { '--chat-header-top': string; '--chat-header-room': string };

const headerTopPx = 8;

export const chatHeaderRoomPx = Number.parseFloat(Sizes['header-default']) + headerTopPx;

export const chatHeaderStyle: ChatHeaderStyle = {
  '--chat-header-top': `${headerTopPx}px`,
  '--chat-header-room': `${chatHeaderRoomPx}px`,
};

export { headerCapsuleClass } from '@mastra/playground-ui/domains/factory';
