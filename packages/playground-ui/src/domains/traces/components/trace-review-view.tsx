import type { LightSpanRecord } from '@mastra/core/storage';
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  HighlighterIcon,
  MessageSquarePlusIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { formatSpanDuration } from '../utils/span-utils';
import { getReadableTraceInput, getReadableTraceOutput } from '../utils/trace-review-utils';
import { Button } from '@/ds/components/Button';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { cn } from '@/lib/utils';

export type TraceReviewTarget = 'case' | 'response' | 'reasoning';

export interface TraceReviewSelection {
  target: TraceReviewTarget;
  quote: string;
}

type DetailedSpan = LightSpanRecord & {
  input?: unknown;
  output?: unknown;
  result?: unknown;
};

export interface TraceReviewViewProps {
  rootSpan?: DetailedSpan;
  spans: LightSpanRecord[];
  isLoading?: boolean;
  onReviewTargetChange?: (target: TraceReviewTarget) => void;
  /** Called when the reviewer selects text in a section and asks to annotate it. */
  onAnnotate?: (selection: TraceReviewSelection) => void;
  /** Rendered under a section heading; receives the section so consumers can show saved annotations inline. */
  annotationsSlot?: (target: TraceReviewTarget) => ReactNode;
  feedbackSlot?: ReactNode;
}

function getStepLabel(span: LightSpanRecord): string {
  const type = span.spanType.toLowerCase().split('_')[0];
  if (type === 'model') return 'Generated the response';
  if (type === 'tool' || type === 'provider') return `Used ${span.name}`;
  if (type === 'memory') return 'Checked conversation context';
  if (type === 'workflow') return `Ran ${span.name}`;
  if (type === 'scorer') return 'Evaluated the response';
  return span.name;
}

export function RawDataDisclosure({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null;

  return (
    <details className="group mt-3">
      <summary
        className={cn(
          'flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1 text-ui-sm text-neutral3',
          'transition-colors select-none hover:bg-surface4 hover:text-neutral5',
          '[&::-webkit-details-marker]:hidden',
        )}
      >
        <ChevronRightIcon className="size-3.5 transition-transform group-open:rotate-90" />
        {label}
      </summary>
      <pre className="bg-surface1 text-ui-sm text-neutral4 mt-2 max-h-64 overflow-auto rounded-lg p-3 whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function getSectionSelection(container: HTMLElement | null): string {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !container) return '';
  if (!selection.anchorNode || !container.contains(selection.anchorNode)) return '';
  return selection.toString().trim();
}

function ReviewSection({
  title,
  content,
  rawValue,
  target,
  onReviewTargetChange,
  onAnnotate,
  annotationsSlot,
}: {
  title: string;
  content: string;
  rawValue?: unknown;
  target: TraceReviewTarget;
  onReviewTargetChange?: (target: TraceReviewTarget) => void;
  onAnnotate?: (selection: TraceReviewSelection) => void;
  annotationsSlot?: (target: TraceReviewTarget) => ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [selectedQuote, setSelectedQuote] = useState('');

  const refreshSelection = () => {
    if (onAnnotate) setSelectedQuote(getSectionSelection(contentRef.current));
  };

  return (
    <section className="border-border1 bg-surface2 rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-ui-lg text-neutral6 font-medium">{title}</h3>
        <div className="flex items-center gap-1">
          {onAnnotate && selectedQuote && (
            <Button
              type="button"
              size="sm"
              variant="primary"
              aria-label={`Annotate selection in ${title.toLowerCase()}`}
              onClick={() => {
                onAnnotate({ target, quote: selectedQuote });
                setSelectedQuote('');
              }}
            >
              <HighlighterIcon />
              Annotate selection
            </Button>
          )}
          {onReviewTargetChange && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Add note about ${title.toLowerCase()}`}
              onClick={() => onReviewTargetChange(target)}
            >
              <MessageSquarePlusIcon />
              Add note
            </Button>
          )}
        </div>
      </div>
      {content ? (
        <div ref={contentRef} onMouseUp={refreshSelection} onKeyUp={refreshSelection}>
          <MarkdownRenderer className="text-ui-md text-neutral5 max-w-[65ch]">{content}</MarkdownRenderer>
        </div>
      ) : (
        <p className="text-ui-md text-neutral3">No readable {title.toLowerCase()} was recorded.</p>
      )}
      <RawDataDisclosure label="Raw message data" value={rawValue} />
      {annotationsSlot?.(target)}
    </section>
  );
}

export function TraceReviewView({
  rootSpan,
  spans,
  isLoading,
  onReviewTargetChange,
  onAnnotate,
  annotationsSlot,
  feedbackSlot,
}: TraceReviewViewProps) {
  if (isLoading) {
    return <p className="text-ui-md text-neutral3 py-8 text-center">Loading review…</p>;
  }

  if (!rootSpan) {
    return <p className="text-ui-md text-neutral3 py-8 text-center">Review content is unavailable for this trace.</p>;
  }

  const input = getReadableTraceInput(rootSpan.input);
  const output = getReadableTraceOutput(rootSpan.output ?? rootSpan.result);
  const steps = spans.filter(span => span.spanId !== rootSpan.spanId);

  return (
    <div className="grid gap-4">
      <ReviewSection
        title="Case"
        content={input}
        rawValue={rootSpan.input}
        target="case"
        onReviewTargetChange={onReviewTargetChange}
        onAnnotate={onAnnotate}
        annotationsSlot={annotationsSlot}
      />
      <ReviewSection
        title="Agent response"
        content={output}
        rawValue={rootSpan.output ?? rootSpan.result}
        target="response"
        onReviewTargetChange={onReviewTargetChange}
        onAnnotate={onAnnotate}
        annotationsSlot={annotationsSlot}
      />

      <section className="border-border1 bg-surface2 rounded-xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-ui-lg text-neutral6 font-medium">How the response was produced</h3>
            <p className="text-ui-sm text-neutral3 mt-1">A plain-language summary of the recorded steps.</p>
          </div>
          {onReviewTargetChange && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="Add note about reasoning"
              onClick={() => onReviewTargetChange('reasoning')}
            >
              <MessageSquarePlusIcon />
              Add note
            </Button>
          )}
        </div>

        {steps.length === 0 ? (
          <p className="text-ui-md text-neutral3">No intermediate steps were recorded.</p>
        ) : (
          <ol className="grid gap-2">
            {steps.map((step, index) => {
              const failed = step.status === 'error';
              const duration = formatSpanDuration(step.startedAt, step.endedAt);
              return (
                <li
                  key={step.spanId}
                  className="bg-surface3 grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg px-3 py-2"
                >
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full text-ui-xs font-medium',
                      failed ? 'bg-accent2/10 text-accent2' : 'bg-surface5 text-neutral5',
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="text-ui-md text-neutral5 flex min-w-0 items-center gap-2">
                    {failed ? (
                      <AlertCircleIcon className="text-accent2 size-4 shrink-0" />
                    ) : (
                      <CheckCircle2Icon className="text-neutral3 size-4 shrink-0" />
                    )}
                    <span className="truncate">{getStepLabel(step)}</span>
                  </span>
                  {duration && <span className="text-ui-sm text-neutral3 tabular-nums">{duration}</span>}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {feedbackSlot}
    </div>
  );
}
