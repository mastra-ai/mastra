import { useCallback, useEffect, useRef, useState } from 'react';

import type { useAgentControllerSession } from './useAgentControllerSession';

type Transcript = ReturnType<typeof useAgentControllerSession>['transcript'];

function getStreamingLength(transcript: Transcript) {
  const lastTranscriptEntry = transcript.entries[transcript.entries.length - 1];
  return lastTranscriptEntry?.kind === 'message' && lastTranscriptEntry.message.role === 'assistant'
    ? lastTranscriptEntry.message.content.parts.reduce((n, part) => {
        if (part.type === 'text') return n + part.text.length;
        if (part.type === 'reasoning') return n + part.reasoning.length;
        return n;
      }, 0)
    : 0;
}

export function useTranscriptScroll(transcript: Transcript) {
  const threadRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const streamingLen = getStreamingLength(transcript);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

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

  useEffect(() => {
    setShowScrollDown(false);
    const raf = requestAnimationFrame(() => scrollToBottom('auto'));
    return () => cancelAnimationFrame(raf);
  }, [transcript.threadId, scrollToBottom]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [transcript.entries.length, transcript.running, transcript.pending, streamingLen]);

  return { threadRef, showScrollDown, scrollToBottom };
}
