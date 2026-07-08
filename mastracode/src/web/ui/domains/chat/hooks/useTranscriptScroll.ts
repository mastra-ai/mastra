import { useCallback, useEffect, useRef, useState } from 'react';

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

export function useTranscriptScroll(transcript: TranscriptState) {
  const threadRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const streamingLen = getStreamingLength(transcript);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

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

  // Thread changes require imperative DOM scrolling after the new transcript has rendered.
  useEffect(() => {
    setShowScrollDown(false);
    const raf = requestAnimationFrame(() => scrollToBottom('auto'));
    return () => cancelAnimationFrame(raf);
  }, [transcript.threadId, scrollToBottom]);

  // Streaming updates should imperatively follow the DOM scroll only while the user is already near the bottom.
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [transcript.entries.length, transcript.running, transcript.pending, streamingLen]);

  return { threadRef, showScrollDown, scrollToBottom };
}
