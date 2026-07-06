import * as React from 'react';

import { MessageScrollerContext, useRequiredMessageScrollerContext } from './message-scroller-context';

export const useMessageScroller = () => {
  const { scrollToEnd, scrollToMessage, scrollToStart } = useRequiredMessageScrollerContext('useMessageScroller');
  return React.useMemo(
    () => ({ scrollToEnd, scrollToMessage, scrollToStart }),
    [scrollToEnd, scrollToMessage, scrollToStart],
  );
};

export const useOptionalMessageScroller = () => {
  const context = React.useContext(MessageScrollerContext);
  return React.useMemo(() => {
    if (!context) return undefined;
    return {
      scrollToEnd: context.scrollToEnd,
      scrollToMessage: context.scrollToMessage,
      scrollToStart: context.scrollToStart,
    };
  }, [context]);
};

export const useMessageScrollerScrollable = () => {
  const { start, end } = useRequiredMessageScrollerContext('useMessageScrollerScrollable');
  return React.useMemo(() => ({ start, end }), [end, start]);
};

export const useOptionalMessageScrollerScrollable = () => {
  const context = React.useContext(MessageScrollerContext);
  return React.useMemo(() => (context ? { start: context.start, end: context.end } : undefined), [context]);
};

export const useMessageScrollerVisibility = () => {
  const { currentAnchorId, visibleMessageIds } = useRequiredMessageScrollerContext('useMessageScrollerVisibility');
  return React.useMemo(() => ({ currentAnchorId, visibleMessageIds }), [currentAnchorId, visibleMessageIds]);
};

export const useOptionalMessageScrollerVisibility = () => {
  const context = React.useContext(MessageScrollerContext);
  return React.useMemo(
    () =>
      context
        ? {
            currentAnchorId: context.currentAnchorId,
            visibleMessageIds: context.visibleMessageIds,
          }
        : undefined,
    [context],
  );
};
