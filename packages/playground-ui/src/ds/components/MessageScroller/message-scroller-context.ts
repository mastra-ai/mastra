import * as React from 'react';

export type MessageScrollerDefaultScrollPosition = 'start' | 'end' | 'last-anchor';
export type MessageScrollerButtonDirection = 'start' | 'end';
export type MessageScrollerScrollAlign = 'start' | 'center' | 'end' | 'nearest';

export type MessageScrollerScrollOptions = {
  align?: MessageScrollerScrollAlign;
  behavior?: ScrollBehavior;
  scrollMargin?: number;
};

export type MessageScrollerScrollable = {
  start: boolean;
  end: boolean;
};

export type MessageScrollerVisibility = {
  currentAnchorId: string | undefined;
  visibleMessageIds: string[];
};

export type MessageScrollerContextValue = MessageScrollerScrollable &
  MessageScrollerVisibility & {
    registerItem: (messageId: string, element: HTMLElement, scrollAnchor: boolean) => () => void;
    scrollToEnd: (options?: MessageScrollerScrollOptions) => boolean;
    scrollToMessage: (messageId: string, options?: MessageScrollerScrollOptions) => boolean;
    scrollToStart: (options?: MessageScrollerScrollOptions) => boolean;
    setContentElement: (element: HTMLDivElement | null) => void;
    setRootElement: (element: HTMLDivElement | null) => void;
    setViewportElement: (element: HTMLDivElement | null) => void;
    syncAfterScroll: () => void;
  };

export const DEFAULT_SCROLLABLE: MessageScrollerScrollable = { start: false, end: false };
export const DEFAULT_VISIBILITY: MessageScrollerVisibility = { currentAnchorId: undefined, visibleMessageIds: [] };
export const DEFAULT_SCROLL_EDGE_THRESHOLD = 8;
export const DEFAULT_SCROLL_MARGIN = 0;
export const DEFAULT_SCROLL_PREVIOUS_ITEM_PEEK = 64;

export const MessageScrollerContext = React.createContext<MessageScrollerContextValue | null>(null);

export const useRequiredMessageScrollerContext = (hookName: string) => {
  const context = React.useContext(MessageScrollerContext);
  if (!context) throw new Error(`${hookName} must be used within MessageScrollerProvider.`);
  return context;
};
