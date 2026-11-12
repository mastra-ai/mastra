import { createContext, createRef, useContext } from 'react';
import type { RefObject } from 'react';

export interface ChatShellRegions {
  transcriptRef: RefObject<HTMLDivElement | null>;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
}

export const createChatShellRegions = (): ChatShellRegions => ({
  transcriptRef: createRef<HTMLDivElement>(),
  composerInputRef: createRef<HTMLTextAreaElement>(),
});

export const ChatShellRegionsContext = createContext<ChatShellRegions | undefined>(undefined);

export const ChatShellComposerInputContext = createContext<RefObject<HTMLTextAreaElement | null> | undefined>(
  undefined,
);

export function useChatShellRegions(): ChatShellRegions {
  const regions = useContext(ChatShellRegionsContext);
  if (!regions) throw new Error('useChatShellRegions must be used within ChatShell');
  return regions;
}
