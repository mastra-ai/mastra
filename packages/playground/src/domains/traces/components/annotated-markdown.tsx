import type { FeedbackRecord } from '@mastra/core/storage';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { format } from 'date-fns';
import { HighlighterIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const MARK_ATTRIBUTE = 'data-annotation-key';

function annotationKey(annotation: FeedbackRecord, index: number): string {
  return annotation.feedbackId ?? `annotation-${index}`;
}

function getQuote(annotation: FeedbackRecord): string | undefined {
  const quote = annotation.metadata?.quote;
  return typeof quote === 'string' && quote.trim() ? quote : undefined;
}

function clearMarks(container: HTMLElement) {
  for (const mark of [...container.querySelectorAll(`mark[${MARK_ATTRIBUTE}]`)]) {
    const parent = mark.parentNode;
    while (mark.firstChild) parent?.insertBefore(mark.firstChild, mark);
    mark.remove();
    parent?.normalize();
  }
}

function findQuoteRange(container: HTMLElement, quote: string): Range | undefined {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    const text = node.textContent ?? '';
    const start = text.indexOf(quote);
    if (start >= 0) {
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + quote.length);
      return range;
    }
    node = walker.nextNode();
  }
  return undefined;
}

function applyMarks(container: HTMLElement, annotations: FeedbackRecord[]) {
  clearMarks(container);
  annotations.forEach((annotation, index) => {
    const quote = getQuote(annotation);
    if (!quote) return;
    const range = findQuoteRange(container, quote);
    if (!range) return;

    const mark = document.createElement('mark');
    mark.setAttribute(MARK_ATTRIBUTE, annotationKey(annotation, index));
    mark.style.backgroundColor = 'color-mix(in oklch, var(--accent1) 25%, transparent)';
    mark.style.color = 'inherit';
    mark.style.cursor = 'pointer';
    mark.style.borderRadius = '2px';
    try {
      range.surroundContents(mark);
    } catch {
      // The quote crosses element boundaries; it stays reachable in the annotation list.
    }
  });
}

export interface AnnotatedMarkdownProps {
  children: string;
  annotations: FeedbackRecord[];
  className?: string;
}

/** Renders markdown with saved annotation quotes highlighted inline; clicking a highlight opens the comment. */
export function AnnotatedMarkdown({ children, annotations, className }: AnnotatedMarkdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeKey, setActiveKey] = useState<string | undefined>();

  useEffect(() => {
    if (containerRef.current) applyMarks(containerRef.current, annotations);
  });

  const activeAnnotation = annotations.find((annotation, index) => annotationKey(annotation, index) === activeKey);

  const handleClick = (event: React.MouseEvent) => {
    const mark = (event.target as HTMLElement).closest?.(`mark[${MARK_ATTRIBUTE}]`);
    setActiveKey(mark?.getAttribute(MARK_ATTRIBUTE) ?? undefined);
  };

  return (
    <div className="relative">
      <div ref={containerRef} onClick={handleClick}>
        <MarkdownRenderer className={className}>{children}</MarkdownRenderer>
      </div>

      {activeAnnotation && (
        <div
          role="dialog"
          aria-label="Annotation"
          className="border-border1 bg-surface4 absolute right-0 bottom-full z-10 mb-2 w-80 rounded-lg border p-3 shadow-lg"
        >
          <div className="text-ui-sm text-neutral3 flex items-center gap-2">
            <HighlighterIcon className="size-3.5" />
            <span className="text-neutral5 font-medium">{activeAnnotation.feedbackUserId || 'Unattributed'}</span>
            <span>{format(new Date(activeAnnotation.timestamp), 'MMM d, h:mm aaa')}</span>
            <button
              type="button"
              aria-label="Close annotation"
              className="text-neutral3 hover:text-neutral6 ml-auto cursor-pointer rounded px-1"
              onClick={() => setActiveKey(undefined)}
            >
              ✕
            </button>
          </div>
          {activeAnnotation.comment && <p className="text-ui-md text-neutral5 mt-2">{activeAnnotation.comment}</p>}
        </div>
      )}
    </div>
  );
}
