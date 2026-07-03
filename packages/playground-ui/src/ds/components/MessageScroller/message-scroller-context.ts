import * as React from 'react';

type MessageScrollerItemRecord = {
  element: HTMLElement;
  scrollAnchor: boolean;
};

export type MessageScrollerVisibility = {
  currentAnchorId: string | undefined;
  visibleMessageIds: string[];
};

type MessageScrollerContextValue = MessageScrollerVisibility & {
  registerItem: (messageId: string, element: HTMLElement, scrollAnchor: boolean) => () => void;
  scrollToMessage: (messageId: string, options?: ScrollIntoViewOptions) => void;
  setViewportElement: (element: HTMLDivElement | null) => void;
};

const MessageScrollerContext = React.createContext<MessageScrollerContextValue | null>(null);

const DEFAULT_SCROLL_OPTIONS = { behavior: 'smooth', block: 'start' } satisfies ScrollIntoViewOptions;
const INTERSECTION_OPTIONS = {
  rootMargin: '0px 0px -20% 0px',
  threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
} satisfies Omit<IntersectionObserverInit, 'root'>;

const visibilityMatches = (left: MessageScrollerVisibility, right: MessageScrollerVisibility) =>
  left.currentAnchorId === right.currentAnchorId &&
  left.visibleMessageIds.length === right.visibleMessageIds.length &&
  left.visibleMessageIds.every((messageId, index) => messageId === right.visibleMessageIds[index]);

const getElementTop = (element: HTMLElement) => element.getBoundingClientRect().top;

export interface MessageScrollerProviderProps {
  children: React.ReactNode;
}

export function MessageScrollerProvider({ children }: MessageScrollerProviderProps) {
  const itemsRef = React.useRef<Map<string, MessageScrollerItemRecord> | null>(null);
  itemsRef.current ??= new Map<string, MessageScrollerItemRecord>();
  const itemsRegistry = itemsRef.current;
  const [itemsVersion, setItemsVersion] = React.useState(0);
  const [viewportElement, setViewportElement] = React.useState<HTMLDivElement | null>(null);
  const [visibility, setVisibility] = React.useState<MessageScrollerVisibility>({
    currentAnchorId: undefined,
    visibleMessageIds: [],
  });

  const publishVisibility = React.useCallback((nextVisibility: MessageScrollerVisibility) => {
    setVisibility(current => (visibilityMatches(current, nextVisibility) ? current : nextVisibility));
  }, []);

  const registerItem = React.useCallback(
    (messageId: string, element: HTMLElement, scrollAnchor: boolean) => {
      itemsRegistry.set(messageId, { element, scrollAnchor });
      setItemsVersion(version => version + 1);

      return () => {
        const current = itemsRegistry.get(messageId);
        if (current?.element !== element) return;

        itemsRegistry.delete(messageId);
        setItemsVersion(version => version + 1);
      };
    },
    [itemsRegistry],
  );

  const scrollToMessage = React.useCallback(
    (messageId: string, options: ScrollIntoViewOptions = DEFAULT_SCROLL_OPTIONS) => {
      itemsRegistry.get(messageId)?.element.scrollIntoView(options);
    },
    [itemsRegistry],
  );

  React.useEffect(() => {
    const items = Array.from(itemsRegistry.entries());
    const anchorItems = items.filter(([, item]) => item.scrollAnchor);
    const fallbackAnchorId = anchorItems.at(-1)?.[0] ?? items.at(-1)?.[0];

    if (items.length === 0) {
      publishVisibility({ currentAnchorId: undefined, visibleMessageIds: [] });
      return;
    }

    if (!viewportElement || typeof IntersectionObserver === 'undefined') {
      publishVisibility({
        currentAnchorId: fallbackAnchorId,
        visibleMessageIds: fallbackAnchorId ? [fallbackAnchorId] : [],
      });
      return;
    }

    const messageIdByElement = new Map<Element, string>();
    for (const [messageId, item] of items) {
      messageIdByElement.set(item.element, messageId);
    }

    const visibleMessageIds = new Set<string>();
    const getCurrentAnchorId = () => {
      const viewportTop = getElementTop(viewportElement);
      const anchors = anchorItems
        .map(([messageId, item]) => ({ messageId, top: getElementTop(item.element) }))
        .sort((left, right) => left.top - right.top);
      const anchoredAboveViewport = anchors.findLast(anchor => anchor.top <= viewportTop + 1);

      if (anchoredAboveViewport) return anchoredAboveViewport.messageId;

      return anchors.find(anchor => visibleMessageIds.has(anchor.messageId))?.messageId ?? fallbackAnchorId;
    };

    const publishObservedVisibility = () => {
      const orderedVisibleMessageIds = items.flatMap(([messageId]) =>
        visibleMessageIds.has(messageId) ? [messageId] : [],
      );

      publishVisibility({
        currentAnchorId: getCurrentAnchorId(),
        visibleMessageIds: orderedVisibleMessageIds,
      });
    };

    publishVisibility({
      currentAnchorId: fallbackAnchorId,
      visibleMessageIds: fallbackAnchorId ? [fallbackAnchorId] : [],
    });

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const messageId = messageIdByElement.get(entry.target);
          if (!messageId) continue;

          if (entry.isIntersecting) {
            visibleMessageIds.add(messageId);
          } else {
            visibleMessageIds.delete(messageId);
          }
        }

        publishObservedVisibility();
      },
      {
        root: viewportElement,
        ...INTERSECTION_OPTIONS,
      },
    );

    for (const [, item] of items) {
      observer.observe(item.element);
    }

    return () => observer.disconnect();
  }, [itemsRegistry, itemsVersion, publishVisibility, viewportElement]);

  const contextValue = React.useMemo<MessageScrollerContextValue>(
    () => ({
      currentAnchorId: visibility.currentAnchorId,
      visibleMessageIds: visibility.visibleMessageIds,
      registerItem,
      scrollToMessage,
      setViewportElement,
    }),
    [registerItem, scrollToMessage, visibility.currentAnchorId, visibility.visibleMessageIds],
  );

  return React.createElement(MessageScrollerContext.Provider, { value: contextValue }, children);
}

export const useMessageScrollerContext = () => {
  const context = React.useContext(MessageScrollerContext);
  if (!context) {
    throw new Error('MessageScroller components must be rendered inside MessageScrollerProvider.');
  }
  return context;
};

export const useOptionalMessageScrollerContext = () => React.useContext(MessageScrollerContext);

export const useMessageScroller = () => {
  const { scrollToMessage } = useMessageScrollerContext();
  return { scrollToMessage };
};

export const useMessageScrollerVisibility = (): MessageScrollerVisibility => {
  const { currentAnchorId, visibleMessageIds } = useMessageScrollerContext();
  return { currentAnchorId, visibleMessageIds };
};

export const useOptionalMessageScrollerVisibility = (): MessageScrollerVisibility | undefined => {
  const context = useOptionalMessageScrollerContext();
  if (!context) return undefined;
  return { currentAnchorId: context.currentAnchorId, visibleMessageIds: context.visibleMessageIds };
};
