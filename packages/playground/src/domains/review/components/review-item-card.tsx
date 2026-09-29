import type { DatasetExperimentResult } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ThumbsUp, ThumbsDown, Trash2, CheckCircle, GaugeIcon } from 'lucide-react';
import { useState } from 'react';
import { TagPicker } from './tag-picker';
import { ComputedTag } from '@/domains/observability/components/computed-tag';

export interface ReviewItem {
  id: string;
  input: unknown;
  output: unknown;
  error: unknown;
  itemId: string;
  datasetId?: string;
  scores?: Record<string, number>;
  tags: string[];
  rating?: 'positive' | 'negative';
  comment?: string;
  clusterId?: string;
  experimentId?: string;
  traceId?: string;
  createdAt?: DatasetExperimentResult['createdAt'];
  status?: DatasetExperimentResult['status'];
  groundTruth?: unknown;
  toolMockReport?: DatasetExperimentResult['toolMockReport'];
}

function formatUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getScoreBadgeVariant(score: number) {
  if (score >= 0.7) return 'green';
  if (score >= 0.4) return 'yellow';
  return 'red';
}

export function ReviewItemCard({
  item,
  isExpanded,
  isSelected,
  isCompleted,
  onToggleSelect,
  onToggleExpand,
  onRate,
  onSetTags,
  onComment,
  onRemove,
  onComplete,
  tagVocabulary,
}: {
  item: ReviewItem;
  isExpanded: boolean;
  isSelected: boolean;
  isCompleted?: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onRate: (rating: 'positive' | 'negative' | undefined) => void;
  onSetTags: (tags: string[]) => void;
  onComment: (comment: string) => void;
  onRemove: () => void;
  onComplete?: () => void | Promise<void>;
  tagVocabulary: string[];
}) {
  const [localComment, setLocalComment] = useState(item.comment || '');
  const [commentSaved, setCommentSaved] = useState(false);

  const inputPreview = (() => {
    try {
      if (typeof item.input === 'string') return item.input.slice(0, 80);
      return JSON.stringify(item.input).slice(0, 80);
    } catch {
      return String(item.input).slice(0, 80);
    }
  })();

  return (
    <div
      className={cn(
        'rounded-lg border border-border p-3 transition-colors',
        isSelected && 'ring-1 ring-accent1',
        item.tags.length > 0 && 'border-l-2 border-l-accent1',
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        {isCompleted ? (
          <Icon size="xs" className="shrink-0 text-positive1">
            <CheckCircle />
          </Icon>
        ) : (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="h-3.5 w-3.5 rounded border-border accent-accent1"
          />
        )}
        <button type="button" onClick={onToggleExpand} className="min-w-0 flex-1 text-left">
          <Txt variant="meta" tone="muted" className="block truncate">
            {inputPreview}
          </Txt>
        </button>
      </div>

      {/* Error indicator */}
      {Boolean(item.error) && (
        <Txt variant="meta" className="mt-1 block truncate text-negative1">
          Error: {typeof item.error === 'string' ? item.error : String(item.error)}
        </Txt>
      )}

      {/* Rating + Tags + Remove row */}
      <TooltipProvider delayDuration={200}>
        <div className="mt-2 flex items-center gap-2">
          {/* Rating: thumbs up / down */}
          <div className="mr-1 flex items-center gap-0.5">
            <Button
              tooltip="Good — this result is acceptable"
              variant={item.rating === 'positive' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onRate(item.rating === 'positive' ? undefined : 'positive')}
              disabled={isCompleted}
            >
              <Icon size="xs" className={item.rating === 'positive' ? 'text-positive1' : ''}>
                <ThumbsUp />
              </Icon>
            </Button>

            <Button
              tooltip="Bad — this result needs fixing"
              variant={item.rating === 'negative' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onRate(item.rating === 'negative' ? undefined : 'negative')}
              disabled={isCompleted}
            >
              <Icon size="xs" className={item.rating === 'negative' ? 'text-negative1' : ''}>
                <ThumbsDown />
              </Icon>
            </Button>
          </div>

          {/* Tags */}
          <div className="min-w-0 flex-1">
            {isCompleted ? (
              <div className="flex flex-wrap gap-1">
                {item.tags.map(tag => (
                  <ComputedTag key={tag} value={tag} size="sm" />
                ))}
              </div>
            ) : (
              <TagPicker tags={item.tags} vocabulary={tagVocabulary} onSetTags={onSetTags} />
            )}
          </div>

          {/* Scores */}
          {item.scores && Object.keys(item.scores).length > 0 && (
            <div className="mr-1 flex items-center gap-1">
              <Icon size="xs" className="text-muted-foreground">
                <GaugeIcon />
              </Icon>
              <div className="flex gap-1">
                {Object.entries(item.scores)
                  .slice(0, 2)
                  .map(([name, score]) => (
                    <Badge key={name} variant={getScoreBadgeVariant(score)}>
                      {name}: {typeof score === 'number' ? score.toFixed(2) : score}
                    </Badge>
                  ))}
                {Object.keys(item.scores).length > 2 && <Badge>+{Object.keys(item.scores).length - 2}</Badge>}
              </div>
            </div>
          )}

          {/* Actions */}
          {!isCompleted && (
            <div className="flex items-center gap-0.5">
              {onComplete && (
                <Button tooltip="Mark as complete" variant="ghost" size="sm" onClick={onComplete}>
                  <Icon size="xs" className="text-positive1">
                    <CheckCircle />
                  </Icon>
                </Button>
              )}
              <Button tooltip="Remove from review" variant="ghost" size="sm" onClick={onRemove}>
                <Icon size="xs" className="text-placeholder hover:text-negative1">
                  <Trash2 />
                </Icon>
              </Button>
            </div>
          )}
        </div>
      </TooltipProvider>

      {/* Expanded: full input/output + comment */}
      {isExpanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {item.experimentId && (
            <div className="flex items-center gap-1.5">
              <Txt variant="meta" tone="muted">
                Experiment:
              </Txt>
              <Txt as="span" variant="meta" tone="muted" font="mono">
                {item.experimentId.slice(0, 8)}
              </Txt>
            </div>
          )}
          <div>
            <Txt variant="meta" tone="muted" className="mb-1 block">
              Input
            </Txt>
            <pre className="max-h-40 overflow-auto rounded bg-background p-2 text-caption whitespace-pre-wrap text-foreground">
              {formatUnknown(item.input)}
            </pre>
          </div>
          {item.output !== undefined && item.output !== null && (
            <div>
              <Txt variant="meta" tone="muted" className="mb-1 block">
                Output
              </Txt>
              <pre className="max-h-40 overflow-auto rounded bg-background p-2 text-caption whitespace-pre-wrap text-foreground">
                {formatUnknown(item.output)}
              </pre>
            </div>
          )}
          {Boolean(item.error) && (
            <div>
              <Txt variant="meta" tone="muted" className="mb-1 block">
                Error
              </Txt>
              <pre className="max-h-20 overflow-auto rounded bg-background p-2 text-caption whitespace-pre-wrap text-negative1">
                {formatUnknown(item.error)}
              </pre>
            </div>
          )}
          {/* Comment */}
          {!isCompleted && (
            <div>
              <Txt variant="meta" tone="muted" className="mb-1 block">
                Comment
              </Txt>
              <Textarea
                value={localComment}
                onChange={e => {
                  setLocalComment(e.target.value);
                  setCommentSaved(false);
                }}
                onBlur={() => {
                  if (localComment !== (item.comment || '')) {
                    onComment(localComment);
                    setCommentSaved(true);
                    setTimeout(() => setCommentSaved(false), 1500);
                  }
                }}
                placeholder="Add a note about this item..."
                rows={2}
                className="text-caption"
              />
              {commentSaved && (
                <Txt variant="meta" className="mt-0.5 text-positive1">
                  Saved
                </Txt>
              )}
            </div>
          )}
          {isCompleted && item.comment && (
            <div>
              <Txt variant="meta" tone="muted" className="mb-1 block">
                Comment
              </Txt>
              <Txt variant="meta" tone="muted" className="block">
                {item.comment}
              </Txt>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
