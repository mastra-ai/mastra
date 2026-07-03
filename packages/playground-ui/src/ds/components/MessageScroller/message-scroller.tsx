import * as React from 'react';
import { useMessageScrollerContext, useOptionalMessageScrollerContext } from './message-scroller-context';

import { cn } from '@/lib/utils';

const setRef = <T,>(ref: React.Ref<T> | undefined, value: T | null) => {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  ref.current = value;
};

export type MessageScrollerProps = React.HTMLAttributes<HTMLDivElement>;

export const MessageScroller = React.forwardRef<HTMLDivElement, MessageScrollerProps>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('relative', className)} {...props} />,
);
MessageScroller.displayName = 'MessageScroller';

export type MessageScrollerViewportProps = React.HTMLAttributes<HTMLDivElement>;

export const MessageScrollerViewport = React.forwardRef<HTMLDivElement, MessageScrollerViewportProps>(
  ({ className, ...props }, ref) => {
    const { setViewportElement } = useMessageScrollerContext();
    const viewportRef = React.useCallback(
      (element: HTMLDivElement | null) => {
        setViewportElement(element);
        setRef(ref, element);
      },
      [ref, setViewportElement],
    );

    return <div ref={viewportRef} className={cn('overflow-y-auto', className)} {...props} />;
  },
);
MessageScrollerViewport.displayName = 'MessageScrollerViewport';

export type MessageScrollerContentProps = React.HTMLAttributes<HTMLDivElement>;

export const MessageScrollerContent = React.forwardRef<HTMLDivElement, MessageScrollerContentProps>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn(className)} {...props} />,
);
MessageScrollerContent.displayName = 'MessageScrollerContent';

export type MessageScrollerItemRenderProps = {
  ref: React.Ref<HTMLDivElement>;
  'data-message-scroller-id': string;
  'data-message-scroll-anchor'?: 'true';
};

export type MessageScrollerItemProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & {
  messageId: string;
  scrollAnchor?: boolean;
  children?: React.ReactNode | ((props: MessageScrollerItemRenderProps) => React.ReactNode);
};

export const MessageScrollerItem = React.forwardRef<HTMLDivElement, MessageScrollerItemProps>(
  ({ children, className, messageId, scrollAnchor = true, ...props }, ref) => {
    const { registerItem } = useMessageScrollerContext();
    const unregisterRef = React.useRef<(() => void) | undefined>(undefined);
    const itemRef = React.useCallback(
      (element: HTMLDivElement | null) => {
        unregisterRef.current?.();
        unregisterRef.current = undefined;
        setRef(ref, element);

        if (!element) return;
        unregisterRef.current = registerItem(messageId, element, scrollAnchor);
      },
      [messageId, ref, registerItem, scrollAnchor],
    );

    const itemProps: MessageScrollerItemRenderProps = {
      ref: itemRef,
      'data-message-scroller-id': messageId,
      'data-message-scroll-anchor': scrollAnchor ? 'true' : undefined,
    };

    if (typeof children === 'function') {
      return <>{children(itemProps)}</>;
    }

    return (
      <div
        ref={itemRef}
        data-message-scroller-id={messageId}
        data-message-scroll-anchor={scrollAnchor ? 'true' : undefined}
        className={cn(className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
MessageScrollerItem.displayName = 'MessageScrollerItem';

export type MessageScrollerButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  messageId: string;
  scrollOptions?: ScrollIntoViewOptions;
};

export const MessageScrollerButton = React.forwardRef<HTMLButtonElement, MessageScrollerButtonProps>(
  ({ messageId, onClick, scrollOptions, ...props }, ref) => {
    const context = useOptionalMessageScrollerContext();

    return (
      <button
        ref={ref}
        type="button"
        onClick={event => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          context?.scrollToMessage(messageId, scrollOptions);
        }}
        {...props}
      />
    );
  },
);
MessageScrollerButton.displayName = 'MessageScrollerButton';
