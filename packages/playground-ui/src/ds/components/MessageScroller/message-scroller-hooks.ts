import * as React from 'react';

import {
  MessageScrollerActionsContext,
  MessageScrollerScrollableContext,
  MessageScrollerVisibilityContext,
  useRequiredMessageScrollerActionsContext,
  useRequiredMessageScrollerScrollableContext,
  useRequiredMessageScrollerVisibilityContext,
} from './message-scroller-context';
import { createVisibilityStore } from './message-scroller-visibility-store';

const DETACHED_VISIBILITY = createVisibilityStore();

export const useMessageScroller = () => {
  const { scrollToEnd, scrollToMessage, scrollToStart } =
    useRequiredMessageScrollerActionsContext('useMessageScroller');
  return React.useMemo(
    () => ({ scrollToEnd, scrollToMessage, scrollToStart }),
    [scrollToEnd, scrollToMessage, scrollToStart],
  );
};

export const useOptionalMessageScroller = () => {
  const context = React.useContext(MessageScrollerActionsContext);
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
  const { start, end } = useRequiredMessageScrollerScrollableContext('useMessageScrollerScrollable');
  return React.useMemo(() => ({ start, end }), [end, start]);
};

export const useOptionalMessageScrollerScrollable = () => {
  const context = React.useContext(MessageScrollerScrollableContext);
  return React.useMemo(() => (context ? { start: context.start, end: context.end } : undefined), [context]);
};

export const useMessageScrollerVisibility = () => {
  const store = useRequiredMessageScrollerVisibilityContext('useMessageScrollerVisibility');
  return React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
};

export const useOptionalMessageScrollerVisibility = () => {
  const store = React.useContext(MessageScrollerVisibilityContext);
  const { subscribe, getSnapshot } = store ?? DETACHED_VISIBILITY;
  const visibility = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return store ? visibility : undefined;
};
