import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { createInitialTranscript, type TranscriptState } from '../../services/transcript';
import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTranscriptScroll } from '../useTranscriptScroll';

interface HookSnapshot {
  showScrollDown: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

const resizeObservers: TestResizeObserver[] = [];

class TestResizeObserver {
  readonly observed = new Set<Element>();

  constructor(private readonly callback: ResizeObserverCallback) {
    resizeObservers.push(this);
  }

  observe(target: Element) {
    this.observed.add(target);
  }

  unobserve(target: Element) {
    this.observed.delete(target);
  }

  disconnect() {
    this.observed.clear();
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

function assistantMessage(id: string, text: string): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    createdAt: new Date(0),
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    },
  } satisfies MastraDBMessage;
}

function messages(text: string): TranscriptState {
  return createInitialTranscript({ messages: [assistantMessage('assistant-1', text)] });
}

function Harness({
  transcriptState,
  threadId = 'thread-a',
  onSnapshot,
}: {
  transcriptState: TranscriptState;
  threadId?: string;
  onSnapshot: (snapshot: HookSnapshot) => void;
}) {
  const scroll = useTranscriptScroll(transcriptState, threadId);

  useEffect(() => {
    onSnapshot({ showScrollDown: scroll.showScrollDown, scrollToBottom: scroll.scrollToBottom });
  }, [onSnapshot, scroll.showScrollDown, scroll.scrollToBottom]);

  return (
    <div data-testid="thread" ref={scroll.threadRef}>
      <div data-testid="transcript-content" />
    </div>
  );
}

function setScrollMetrics(el: HTMLElement, metrics: { scrollHeight: number; clientHeight: number; scrollTop: number }) {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: metrics.scrollHeight });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: metrics.clientHeight });
  el.scrollTop = metrics.scrollTop;
}

function installScrollTo(el: HTMLElement) {
  const scrollTo = vi.fn((options?: ScrollToOptions | number) => {
    if (typeof options === 'object' && typeof options.top === 'number') el.scrollTop = options.top;
    if (typeof options === 'number') el.scrollTop = options;
  });
  el.scrollTo = scrollTo;
  return scrollTo;
}

function dispatchScroll(el: HTMLElement) {
  act(() => {
    el.dispatchEvent(new Event('scroll'));
  });
}

function dispatchUserScroll(el: HTMLElement) {
  const targetScrollTop = el.scrollTop;
  act(() => {
    el.scrollTop = el.scrollHeight - el.clientHeight;
    el.dispatchEvent(new Event('scroll'));
    el.scrollTop = targetScrollTop;
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: -120 }));
    el.dispatchEvent(new Event('scroll'));
  });
}

function flushAnimationFrame() {
  act(() => {
    vi.advanceTimersByTime(16);
  });
}

describe('useTranscriptScroll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resizeObservers.length = 0;
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps following when an existing tool entry grows in place', () => {
    const snapshots: HookSnapshot[] = [];
    render(<Harness transcriptState={messages('hello')} onSnapshot={snapshot => snapshots.push(snapshot)} />);
    const el = screen.getByTestId('thread');
    const content = screen.getByTestId('transcript-content');

    setScrollMetrics(el, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    dispatchScroll(el);
    const scrollTo = installScrollTo(el);
    setScrollMetrics(el, { scrollHeight: 1400, clientHeight: 400, scrollTop: 600 });

    expect(resizeObservers[0]?.observed.has(content)).toBe(true);
    act(() => resizeObservers[0]?.trigger());

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 1400, behavior: 'auto' });
    expect(snapshots.at(-1)?.showScrollDown).toBe(false);
  });

  it('keeps following when attached content grows without user scroll', () => {
    const snapshots: HookSnapshot[] = [];
    const { rerender } = render(
      <Harness transcriptState={messages('hello')} onSnapshot={snapshot => snapshots.push(snapshot)} />,
    );
    const el = screen.getByTestId('thread');

    setScrollMetrics(el, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    dispatchScroll(el);
    flushAnimationFrame();
    const scrollTo = installScrollTo(el);

    setScrollMetrics(el, { scrollHeight: 1300, clientHeight: 400, scrollTop: 600 });
    rerender(
      <Harness
        transcriptState={messages('hello with more streamed text')}
        onSnapshot={snapshot => snapshots.push(snapshot)}
      />,
    );

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 1300, behavior: 'auto' });
    expect(snapshots.at(-1)?.showScrollDown).toBe(false);
  });

  it('does not follow streaming updates after intentional user scroll-away', () => {
    const snapshots: HookSnapshot[] = [];
    const { rerender } = render(
      <Harness transcriptState={messages('hello')} onSnapshot={snapshot => snapshots.push(snapshot)} />,
    );
    const el = screen.getByTestId('thread');

    setScrollMetrics(el, { scrollHeight: 1000, clientHeight: 400, scrollTop: 200 });
    flushAnimationFrame();
    dispatchUserScroll(el);
    flushAnimationFrame();
    const scrollTo = installScrollTo(el);
    rerender(
      <Harness
        transcriptState={messages('hello with more streamed text')}
        onSnapshot={snapshot => snapshots.push(snapshot)}
      />,
    );

    expect(scrollTo).not.toHaveBeenCalled();
    expect(snapshots.at(-1)?.showScrollDown).toBe(true);
  });

  it('reattaches after returning to the bottom', () => {
    const snapshots: HookSnapshot[] = [];
    const { rerender } = render(
      <Harness transcriptState={messages('hello')} onSnapshot={snapshot => snapshots.push(snapshot)} />,
    );
    const el = screen.getByTestId('thread');

    setScrollMetrics(el, { scrollHeight: 1000, clientHeight: 400, scrollTop: 200 });
    flushAnimationFrame();
    dispatchUserScroll(el);
    setScrollMetrics(el, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    dispatchScroll(el);
    const scrollTo = installScrollTo(el);
    rerender(
      <Harness
        transcriptState={messages('hello after returning to bottom')}
        onSnapshot={snapshot => snapshots.push(snapshot)}
      />,
    );

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 1000, behavior: 'auto' });
    expect(snapshots.at(-1)?.showScrollDown).toBe(false);
  });

  it('reattaches when the scroll-down control jumps to the latest message', () => {
    const snapshots: HookSnapshot[] = [];
    const { rerender } = render(
      <Harness transcriptState={messages('hello')} onSnapshot={snapshot => snapshots.push(snapshot)} />,
    );
    const el = screen.getByTestId('thread');

    setScrollMetrics(el, { scrollHeight: 1000, clientHeight: 400, scrollTop: 200 });
    flushAnimationFrame();
    dispatchUserScroll(el);
    const scrollTo = installScrollTo(el);
    act(() => snapshots.at(-1)?.scrollToBottom('auto'));
    rerender(
      <Harness transcriptState={messages('hello after jump')} onSnapshot={snapshot => snapshots.push(snapshot)} />,
    );

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 1000, behavior: 'auto' });
    expect(snapshots.at(-1)?.showScrollDown).toBe(false);
  });

  it('reattaches on thread switch', () => {
    const snapshots: HookSnapshot[] = [];
    const { rerender } = render(
      <Harness transcriptState={messages('hello')} onSnapshot={snapshot => snapshots.push(snapshot)} />,
    );
    const el = screen.getByTestId('thread');

    setScrollMetrics(el, { scrollHeight: 1000, clientHeight: 400, scrollTop: 200 });
    flushAnimationFrame();
    dispatchUserScroll(el);
    const scrollTo = installScrollTo(el);
    rerender(
      <Harness
        transcriptState={messages('new thread text')}
        threadId="thread-b"
        onSnapshot={snapshot => snapshots.push(snapshot)}
      />,
    );
    flushAnimationFrame();

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 1000, behavior: 'auto' });
    expect(snapshots.at(-1)?.showScrollDown).toBe(false);
  });
});
