import { useEffect, useEffectEvent, useRef, useState } from 'react';

import type { TranscriptState } from '../services/transcript';

function getStreamingLength(transcript: TranscriptState) {
  const lastTranscriptEntry = transcript.entries[transcript.entries.length - 1];
  return lastTranscriptEntry?.kind === 'message' && lastTranscriptEntry.message.role === 'assistant'
    ? lastTranscriptEntry.message.content.parts.reduce((n, part) => {
        if (part.type === 'text') return n + part.text.length;
        if (part.type === 'reasoning') return n + part.reasoning.length;
        return n;
      }, 0)
    : 0;
}

function nearBottom(el: HTMLDivElement) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < 160;
}

export function useTranscriptScroll(transcript: TranscriptState, threadId?: string) {
  const threadRef = useRef<HTMLDivElement>(null);
  const attachedRef = useRef(true);
  const programmaticScrollRef = useRef(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const streamingLen = getStreamingLength(transcript);

  const setAttached = (attached: boolean) => {
    attachedRef.current = attached;
    setShowScrollDown(!attached);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = threadRef.current;
    if (!el) return;
    programmaticScrollRef.current = behavior === 'smooth' && el.scrollHeight > el.clientHeight;
    setAttached(true);
    el.scrollTo({ top: el.scrollHeight, behavior });
    if (behavior === 'smooth') requestAnimationFrame(() => (programmaticScrollRef.current = false));
  };

  // Scroll position is DOM state; user-initiated upward scrolls detach follow intent, while
  // layout growth alone cannot detach an already attached transcript.
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const markUserScrollIntent = () => {
      programmaticScrollRef.current = false;
    };
    const onScroll = () => {
      if (nearBottom(el)) {
        programmaticScrollRef.current = false;
        setAttached(true);
        return;
      }
      if (programmaticScrollRef.current) return;
      setAttached(false);
    };
    el.addEventListener('wheel', markUserScrollIntent, { passive: true });
    el.addEventListener('touchmove', markUserScrollIntent, { passive: true });
    el.addEventListener('keydown', markUserScrollIntent);
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      el.removeEventListener('wheel', markUserScrollIntent);
      el.removeEventListener('touchmove', markUserScrollIntent);
      el.removeEventListener('keydown', markUserScrollIntent);
      el.removeEventListener('scroll', onScroll);
    };
  }, []);

  const scrollToBottomOnThreadChange = useEffectEvent(scrollToBottom);
  const followLayoutChange = useEffectEvent(() => {
    if (attachedRef.current) scrollToBottom('auto');
  });

  // Thread changes require imperative DOM scrolling after the new transcript has rendered.
  useEffect(() => {
    setAttached(true);
    const raf = requestAnimationFrame(() => scrollToBottomOnThreadChange('auto'));
    return () => cancelAnimationFrame(raf);
  }, [threadId]);

  // Streaming updates should follow while explicitly attached. Distance-to-bottom can change
  // because a tool/result expanded; that layout movement is not user intent.
  useEffect(() => {
    if (attachedRef.current) scrollToBottom('smooth');
  }, [transcript.entries.length, transcript.pending, streamingLen]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => followLayoutChange());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { threadRef, showScrollDown, scrollToBottom };
}
