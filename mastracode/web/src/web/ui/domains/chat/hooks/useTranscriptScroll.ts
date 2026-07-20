import { useEffect, useEffectEvent, useRef, useState } from 'react';

import type { MastraDBMessage } from '@mastra/client-js';

function getStreamingLength(messages: MastraDBMessage[]) {
  const lastMessage = messages[messages.length - 1];
  return lastMessage?.role === 'assistant'
    ? lastMessage.content.parts.reduce((n, part) => {
        if (part.type === 'text') return n + part.text.length;
        if (part.type === 'reasoning') return n + part.reasoning.length;
        return n;
      }, 0)
    : 0;
}

export function useTranscriptScroll(messages: MastraDBMessage[], pending: boolean, threadId?: string) {
  const threadRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const streamingLen = getStreamingLength(messages);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  // Scroll position is DOM state; subscribe to scroll events and mirror bottom proximity for UI controls.
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
      setShowScrollDown(!nearBottom);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToBottomOnThreadChange = useEffectEvent(scrollToBottom);

  // Thread changes require imperative DOM scrolling after the new transcript has rendered.
  useEffect(() => {
    setShowScrollDown(false);
    const raf = requestAnimationFrame(() => scrollToBottomOnThreadChange('auto'));
    return () => cancelAnimationFrame(raf);
  }, [threadId]);

  // Streaming updates should imperatively follow the DOM scroll only while the user is already near the bottom.
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, pending, streamingLen]);

  return { threadRef, showScrollDown, scrollToBottom };
}
