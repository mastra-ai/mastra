import { Braces, ListTodo, MessageSquareReply, ScrollText } from 'lucide-react';
import {
  compressionRatio,
  extractedValueEntries,
  formatExtractedValue,
  formatTokens,
} from './observation-marker-format';
import { ObservationRenderer } from './observation-renderer';
import { ActivityItem } from '@/ds/components/ai/activity';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { Txt } from '@/ds/components/Txt';
import { formatDuration } from '@/utils/duration';

const markdownCode = '[&_code]:rounded [&_code]:bg-fill [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-meta';

export interface ObservationStatsProps {
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
}

export const ObservationStats = ({ inputTokens, outputTokens, durationMs }: ObservationStatsProps) => {
  const ratio = compressionRatio(inputTokens, outputTokens);
  const stats = [
    inputTokens ? `Input: ${formatTokens(inputTokens)}` : undefined,
    outputTokens ? `Output: ${formatTokens(outputTokens)}` : undefined,
    ratio && ratio > 1 ? `Compression: ${ratio}x` : undefined,
    durationMs ? `Duration: ${formatDuration(durationMs)}` : undefined,
  ].filter(Boolean);

  if (stats.length === 0) return null;

  return (
    <Txt as="p" variant="meta" tone="muted" className="tabular-nums">
      {stats.join(' · ')}
    </Txt>
  );
};

export interface ObservationSectionsProps {
  observations?: string;
  isReflection: boolean;
  maxHeight: string;
  currentTask?: string;
  suggestedResponse?: string;
}

export const ObservationSections = ({
  observations,
  isReflection,
  maxHeight,
  currentTask,
  suggestedResponse,
}: ObservationSectionsProps) => {
  const hasSideSections = Boolean(currentTask || suggestedResponse);
  const observationsLabel = isReflection ? 'Reflections' : 'Observations';

  return (
    <>
      {observations &&
        (hasSideSections ? (
          <ActivityItem icon={<ScrollText />} label={observationsLabel} aria-label={observationsLabel} defaultOpen>
            <ObservationRenderer observations={observations} maxHeight={maxHeight} />
          </ActivityItem>
        ) : (
          <ObservationRenderer observations={observations} maxHeight={maxHeight} />
        ))}
      {currentTask && (
        <ActivityItem icon={<ListTodo />} label="Current task" aria-label="Current task">
          <MarkdownRenderer className={`text-caption text-foreground ${markdownCode}`}>{currentTask}</MarkdownRenderer>
        </ActivityItem>
      )}
      {suggestedResponse && (
        <ActivityItem icon={<MessageSquareReply />} label="Suggested response" aria-label="Suggested response">
          <MarkdownRenderer className={`text-caption text-foreground/80 italic ${markdownCode}`}>
            {suggestedResponse}
          </MarkdownRenderer>
        </ActivityItem>
      )}
    </>
  );
};

export interface ExtractionsProps {
  extractedValues?: Record<string, unknown>;
  extractionFailures?: Array<{ slug: string; error: string }>;
}

export const Extractions = ({ extractedValues, extractionFailures = [] }: ExtractionsProps) => {
  const entries = extractedValueEntries(extractedValues);
  if (entries.length === 0 && extractionFailures.length === 0) return null;

  const detail = [
    `${entries.length} extracted`,
    extractionFailures.length > 0 ? `${extractionFailures.length} failed` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ActivityItem icon={<Braces />} label="Extractions" detail={detail} detailFont="sans" aria-label="Extractions">
      {entries.map(([slug, value]) => (
        <div key={slug} className="rounded-md border border-border bg-fill-subtle p-2">
          <Txt as="div" variant="meta" tone="muted" className="tracking-wide uppercase">
            {slug}
          </Txt>
          {typeof value === 'object' && value !== null ? (
            <pre className="mt-1 max-h-40 overflow-auto text-caption break-words whitespace-pre-wrap text-foreground/80">
              {formatExtractedValue(value)}
            </pre>
          ) : (
            <MarkdownRenderer className={`mt-1 text-caption text-foreground/80 ${markdownCode}`}>
              {formatExtractedValue(value)}
            </MarkdownRenderer>
          )}
        </div>
      ))}
      {extractionFailures.map(failure => (
        <div
          key={failure.slug}
          className="rounded-md border border-destructive-edge bg-destructive-subtle p-2 text-destructive-subtle-foreground"
        >
          <Txt as="div" variant="meta" className="tracking-wide uppercase">
            {failure.slug}
          </Txt>
          <Txt as="div" variant="caption" className="mt-1">
            {failure.error}
          </Txt>
        </div>
      ))}
    </ActivityItem>
  );
};
