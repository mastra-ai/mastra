import { Dot } from 'lucide-react';
import { Icon } from '../Icon/Icon';
import { HTMLAttributes, useEffect, useRef } from 'react';
import { twMerge } from 'tailwind-merge';

export interface MessageProps extends HTMLAttributes<HTMLDivElement> {
  position: 'left' | 'right';
}

export const MessageClass = 'mastra:flex mastra:flex-col mastra:w-full mastra:py-4 mastra:gap-2 mastra:group';
export const Message = ({ position, className, children, ...props }: MessageProps) => {
  return (
    <div
      className={
        className ||
        twMerge(
          MessageClass,
          position === 'left'
            ? ''
            : 'mastra:items-end mastra:[&_.mastra-message-content]:bg-surface4 mastra:[&_.mastra-message-content]:px-4',
        )
      }
      {...props}
    >
      {children}
    </div>
  );
};

export interface MessageContentProps extends HTMLAttributes<HTMLDivElement> {
  isStreaming?: boolean;
}
export const MessageContentClass =
  'mastra:max-w-4/5 mastra:py-2 mastra:text-text6 mastra:rounded-lg mastra-message-content mastra:text-md';
export const MessageContent = ({ children, className, isStreaming, ...props }: MessageContentProps) => {
  return (
    <div className={className || MessageContentClass} {...props}>
      {children}
      {isStreaming && <MessageStreaming />}
    </div>
  );
};

export const MessageActionsClass =
  'mastra:gap-2 mastra:flex mastra:opacity-0 mastra:group-hover:opacity-100 mastra:group-focus-within:opacity-100 mastra:items-center';
export const MessageActions = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={className || MessageActionsClass} {...props}>
      {children}
    </div>
  );
};

export const MessageUsagesClass = 'mastra:flex mastra:gap-2 mastra:items-center';
export const MessageUsages = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={className || MessageUsagesClass} {...props}>
      {children}
    </div>
  );
};

export const MessageUsageClass =
  'mastra:flex mastra:gap-2 mastra:items-center mastra:font-mono mastra:text-xs mastra:bg-surface3 mastra:rounded-lg mastra:px-2 mastra:py-1';
export const MessageUsage = ({ children, className, ...props }: HTMLAttributes<HTMLDListElement>) => {
  return (
    <dl className={className || MessageUsageClass} {...props}>
      {children}
    </dl>
  );
};

export const MessageUsageEntryClass = 'mastra:text-text3 mastra:text-xs mastra:flex mastra:gap-1 mastra:items-center';
export const MessageUsageEntry = ({ children, className, ...props }: HTMLAttributes<HTMLSpanElement>) => {
  return (
    <dt className={className || MessageUsageEntryClass} {...props}>
      {children}
    </dt>
  );
};

export const MessageUsageValueClass = 'mastra:text-text6 mastra:text-xs';
export const MessageUsageValue = ({ children, className, ...props }: HTMLAttributes<HTMLSpanElement>) => {
  return (
    <dd className={className || MessageUsageValueClass} {...props}>
      {children}
    </dd>
  );
};

export const MessageListClass = 'mastra:overflow-y-auto mastra:h-full mastra-list';

export const MessageList = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Force scroll to bottom after DOM update
    const scrollToBottom = () => {
      if (!listRef.current) return;
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    };

    requestAnimationFrame(scrollToBottom);
  });

  return (
    <div className={className || MessageListClass} {...props} ref={listRef}>
      {children}
    </div>
  );
};

export const MessageStreamingClass =
  'mastra:inline-block mastra:w-[2px] mastra:h-[1em] mastra:bg-text5 mastra:ml-0.5 mastra:align-text-bottom mastra:animate-pulse';

export const MessageStreaming = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>) => {
  return <span className={className || MessageStreamingClass} {...props} />;
};
