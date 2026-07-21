import type { LoadMoreHistory } from '../context/ChatTranscriptContext';
import type { TranscriptState } from '../services/transcript';
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';

function getStreamingLength(transcript: TranscriptState) {
  const lastEntry = transcript.entries[transcript.entries.length - 1];
  return lastEntry?.kind === 'message' && lastEntry.message.role === 'assistant'
    ? lastEntry.message.content.parts.reduce((n, part) => {
        if (part.type === 'text') return n + part.text.length;
        if (part.type === 'reasoning') return n + part.reasoning.length;
        return n;
      }, 0)
    : 0;
}

function nearBottom(el: HTMLDivElement) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < 160;
}

/** Trigger older-history load-more when scrolled within this many px of the top. */
const LOAD_MORE_THRESHOLD = 160;

export function useTranscriptScroll(transcript: TranscriptState, threadId?: string, loadMore?: LoadMoreHistory) {
  const threadRef = useRef<HTMLDivElement>(null);
  const attachedRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const streamingLen = getStreamingLength(transcript);

  // Anchor preservation for prepends: when older messages are added at the top,
  // the scroll container grows upward and the viewport would jump. We remember
  // the pre-prepend scroll metrics and, once the taller content lands, restore
  // the reading position by offsetting scrollTop by the height delta.
  const entryCount = transcript.entries.length;
  const firstEntry = transcript.entries[0];
  const firstEntryId = firstEntry && 'id' in firstEntry ? firstEntry.id : undefined;
  const prevFirstEntryIdRef = useRef(firstEntryId);
  const anchorRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const canLoadMore = Boolean(loadMore?.hasMore) && !loadMore?.isLoading && Boolean(loadMore?.load);

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

  // Request older history when the user scrolls near the top. Snapshot the
  // pre-prepend scroll metrics first so the layout effect can restore position
  // once the taller content lands. Guarded so a single scroll-to-top triggers at
  // most one in-flight fetch (anchor stays set until the prepend is consumed).
  const maybeLoadMore = useEffectEvent((el: HTMLDivElement) => {
    if (!canLoadMore) return;
    if (el.scrollTop > LOAD_MORE_THRESHOLD) return;
    if (anchorRef.current) return;
    anchorRef.current = { scrollHeight: el.scrollHeight, scrollTop: el.scrollTop };
    loadMore?.load?.();
  });

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const onScroll = () => {
      const scrollTop = el.scrollTop;
      if (nearBottom(el)) setAttached(true);
      else if (scrollTop < lastScrollTopRef.current) setAttached(false);
      lastScrollTopRef.current = scrollTop;
      maybeLoadMore(el);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToBottomOnThreadChange = useEffectEvent(scrollToBottom);
  const followLayoutChange = useEffectEvent(() => {
    if (attachedRef.current) scrollToBottom('auto');
  });

  useEffect(() => {
    setAttached(true);
    const raf = requestAnimationFrame(() => scrollToBottomOnThreadChange('auto'));
    return () => cancelAnimationFrame(raf);
  }, [threadId]);

  useEffect(() => {
    if (attachedRef.current) scrollToBottom('auto');
  }, [transcript.entries.length, transcript.pending, streamingLen]);

  // Restore the reading position after older messages are prepended. A prepend
  // is identified by the timeline's first entry id changing (a live append grows
  // the tail and leaves the head untouched, so it is ignored here). When that
  // happens while an anchor is pending, offset scrollTop by how much taller the
  // content got so the messages under the viewport stay put instead of jumping.
  useLayoutEffect(() => {
    const el = threadRef.current;
    const headChanged = firstEntryId !== prevFirstEntryIdRef.current;
    prevFirstEntryIdRef.current = firstEntryId;
    const anchor = anchorRef.current;
    if (!el || !anchor || !headChanged) return;
    anchorRef.current = null;
    const delta = el.scrollHeight - anchor.scrollHeight;
    if (delta > 0) el.scrollTop = anchor.scrollTop + delta;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstEntryId, entryCount]);

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
