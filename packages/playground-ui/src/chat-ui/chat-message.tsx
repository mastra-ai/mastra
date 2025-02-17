import { cva, type VariantProps } from 'class-variance-authority';
import React, { useMemo } from 'react';

import { cn } from '../lib/utils';

import { FilePreview } from './file-preview';
import { MarkdownRenderer } from './markdown-renderer';

const chatBubbleVariants = cva('group/message relative break-words rounded-xl px-3 py-2 text-sm sm:max-w-[70%]', {
  variants: {
    isUser: {
      true: 'bg-primary text-primary-foreground',
      false: 'bg-muted text-foreground',
    },
    isError: {
      true: 'bg-red-100 dark:bg-red-900/20',
      false: '',
    },
    animation: {
      none: '',
      slide: 'duration-300 animate-in fade-in-0',
      scale: 'duration-300 animate-in fade-in-0 zoom-in-75',
      fade: 'duration-500 animate-in fade-in-0',
    },
  },
  compoundVariants: [
    {
      isUser: true,
      animation: 'slide',
      class: 'slide-in-from-right',
    },
    {
      isUser: false,
      animation: 'slide',
      class: 'slide-in-from-left',
    },
    {
      isUser: true,
      animation: 'scale',
      class: 'origin-bottom-right',
    },
    {
      isUser: false,
      animation: 'scale',
      class: 'origin-bottom-left',
    },
  ],
});

type Animation = VariantProps<typeof chatBubbleVariants>['animation'];

interface Attachment {
  name?: string;
  contentType?: string;
  url: string;
}

export interface Message {
  id?: string;
  role?: 'user' | 'assistant';
  content: string;
  isError?: boolean;
  createdAt?: Date;
}

export interface ChatMessageProps extends Message {
  showTimeStamp?: boolean;
  animation?: Animation;
  actions?: React.ReactNode;
  className?: string;
  experimental_attachments?: Attachment[];
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  role,
  content,
  createdAt,
  showTimeStamp = false,
  animation = 'scale',
  actions,
  className,
  experimental_attachments,
  isError = false,
}) => {
  const isUser = role === 'user';

  const files = useMemo(() => {
    return experimental_attachments?.map(attachment => {
      const dataArray = dataUrlToUint8Array(attachment.url);
      const file = new File([dataArray], attachment.name ?? 'Unknown');
      return file;
    });
  }, [experimental_attachments]);

  const formattedTime = createdAt?.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
      {files ? (
        <div className="mb-1 flex flex-wrap gap-2">
          {files.map((file, index) => {
            return <FilePreview file={file} key={index} />;
          })}
        </div>
      ) : null}

      <div className={cn(chatBubbleVariants({ isUser, isError, animation: 'none' }), className)}>
        <div>
          <MarkdownRenderer>{content}</MarkdownRenderer>
        </div>

        {role === 'assistant' && actions ? (
          <div className="bg-background text-foreground absolute -bottom-4 right-2 flex space-x-1 rounded-lg border p-1 opacity-0 transition-opacity group-hover/message:opacity-100">
            {actions}
          </div>
        ) : null}
      </div>

      {showTimeStamp && createdAt ? (
        <time
          dateTime={createdAt.toISOString()}
          className={cn(
            'mt-1 block px-1 text-xs opacity-50',
            animation !== 'none' && 'animate-in fade-in-0 duration-500',
          )}
        >
          {formattedTime}
        </time>
      ) : null}
    </div>
  );
};

function dataUrlToUint8Array(data: string) {
  const base64 = data.split(',')[1];
  const buf = Buffer.from(base64 ?? '', 'base64');
  return new Uint8Array(buf);
}
