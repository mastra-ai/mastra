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
  const lastScrollTopRef = useRef(0);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const streamingLen = getStreamingLength(transcript);

  const setAttached = (attached: boolean) => {
    attachedRef.current = attached;
    setShowScrollDown(!attached);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = threadRef.current;
    if (!el) return;
    setAttached(true);
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  // Scroll position is DOM state. Only upward movement detaches follow intent; downward
  // movement may come from smooth scrolling or browser scroll anchoring as content grows.
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const onScroll = () => {
      const scrollTop = el.scrollTop;
      if (nearBottom(el)) setAttached(true);
      else if (scrollTop < lastScrollTopRef.current) setAttached(false);
      lastScrollTopRef.current = scrollTop;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
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

  // Streaming updates should follow immediately while attached. Repeated smooth-scroll
  // animations lag behind fast token and tool-output updates.
  useEffect(() => {
    if (attachedRef.current) scrollToBottom('auto');
  }, [transcript.entries.length, transcript.pending, streamingLen]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observedChildren = new Set<Element>();
    const resizeObserver = new ResizeObserver(() => followLayoutChange());
    const syncObservedChildren = () => {
      const children = new Set(Array.from(el.children));
      for (const child of observedChildren) {
        if (!children.has(child)) {
          resizeObserver.unobserve(child);
          observedChildren.delete(child);
        }
      }
      for (const child of children) {
        if (!observedChildren.has(child)) {
          resizeObserver.observe(child);
          observedChildren.add(child);
        }
      }
    };
    const mutationObserver = new MutationObserver(syncObservedChildren);

    resizeObserver.observe(el);
    syncObservedChildren();
    mutationObserver.observe(el, { childList: true });
    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, []);

  return { threadRef, showScrollDown, scrollToBottom };
}
