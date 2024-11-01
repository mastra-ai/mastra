'use client';

import { useCallback, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

import { Textarea, TextareaProps } from './textarea';

const TextareaWithAutoResize = ({ maxHeight, className, ...props }: TextareaProps & { maxHeight?: number }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = maxHeight
        ? `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`
        : `${textareaRef.current.scrollHeight}px`;
    }
  }, [maxHeight]);

  useEffect(() => {
    autoResize();
  }, [props.value, autoResize]);

  return <Textarea ref={textareaRef} className={cn('resize-none', className)} {...props} />;
};

export { TextareaWithAutoResize };
