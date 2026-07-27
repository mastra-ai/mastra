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
}

function formatUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
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
        'border border-border1 rounded-lg p-3 transition-colors',
        isSelected && 'ring-1 ring-accent1',
        item.tags.length > 0 && 'border-l-2 border-l-accent1',
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        {isCompleted ? (
          <Icon size="sm" className="text-positive1 shrink-0">
            <CheckCircle />
          </Icon>
        ) : (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="border-border1 accent-accent1 h-3.5 w-3.5 rounded"
          />
        )}
        <button type="button" onClick={onToggleExpand} className="min-w-0 flex-1 text-left">
          <Txt variant="ui-xs" className="text-neutral4 block truncate">
            {inputPreview}
          </Txt>
        </button>
      </div>

      {/* Error indicator */}
      {Boolean(item.error) && (
        <Txt variant="ui-xs" className="text-negative1 mt-1 block truncate">
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
              <Icon size="sm" className={item.rating === 'positive' ? 'text-positive1' : ''}>
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
              <Icon size="sm" className={item.rating === 'negative' ? 'text-negative1' : ''}>
                <ThumbsDown />
              </Icon>
            </Button>
          </div>

          {/* Tags */}
          <div className="min-w-0 flex-1">
            {isCompleted ? (
              <div className="flex flex-wrap gap-1">
                {item.tags.map(tag => (
                  <Badge key={tag} variant="default">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : (
              <TagPicker tags={item.tags} vocabulary={tagVocabulary} onSetTags={onSetTags} />
            )}
          </div>

          {/* Scores */}
          {item.scores && Object.keys(item.scores).length > 0 && (
            <div className="mr-1 flex items-center gap-1">
              <Icon size="sm" className="text-neutral3">
                <GaugeIcon />
              </Icon>
              <div className="flex gap-1">
                {Object.entries(item.scores)
                  .slice(0, 2)
                  .map(([name, score]) => (
                    <Badge key={name} variant={score >= 0.7 ? 'success' : score >= 0.4 ? 'warning' : 'error'}>
                      {name}: {typeof score === 'number' ? score.toFixed(2) : score}
                    </Badge>
                  ))}
                {Object.keys(item.scores).length > 2 && (
                  <Badge variant="default">+{Object.keys(item.scores).length - 2}</Badge>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {!isCompleted && (
            <div className="flex items-center gap-0.5">
              {onComplete && (
                <Button tooltip="Mark as complete" variant="ghost" size="sm" onClick={onComplete}>
                  <Icon size="sm" className="text-positive1">
                    <CheckCircle />
                  </Icon>
                </Button>
              )}
              <Button tooltip="Remove from review" variant="ghost" size="sm" onClick={onRemove}>
                <Icon size="sm" className="text-neutral2 hover:text-negative1">
                  <Trash2 />
                </Icon>
              </Button>
            </div>
          )}
        </div>
      </TooltipProvider>

      {/* Expanded: full input/output + comment */}
      {isExpanded && (
        <div className="border-border1 mt-3 space-y-3 border-t pt-3">
          {item.experimentId && (
            <div className="flex items-center gap-1.5">
              <Txt variant="ui-xs" className="text-neutral3">
                Experiment:
              </Txt>
              <code className="text-neutral4 bg-surface2 rounded px-1.5 py-0.5 font-mono text-[10px]">
                {item.experimentId.slice(0, 8)}
              </code>
            </div>
          )}
          <div>
            <Txt variant="ui-xs" className="text-neutral3 mb-1 block font-semibold">
              Input
            </Txt>
            <pre className="text-neutral5 bg-surface2 max-h-40 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
              {formatUnknown(item.input)}
            </pre>
          </div>
          {item.output !== undefined && item.output !== null && (
            <div>
              <Txt variant="ui-xs" className="text-neutral3 mb-1 block font-semibold">
                Output
              </Txt>
              <pre className="text-neutral5 bg-surface2 max-h-40 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
                {formatUnknown(item.output)}
              </pre>
            </div>
          )}
          {Boolean(item.error) && (
            <div>
              <Txt variant="ui-xs" className="text-neutral3 mb-1 block font-semibold">
                Error
              </Txt>
              <pre className="text-negative1 bg-surface2 max-h-20 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
                {formatUnknown(item.error)}
              </pre>
            </div>
          )}
          {/* Comment */}
          {!isCompleted && (
            <div>
              <Txt variant="ui-xs" className="text-neutral3 mb-1 block font-semibold">
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
                className="text-xs"
              />
              {commentSaved && (
                <Txt variant="ui-xs" className="text-positive1 mt-0.5">
                  Saved
                </Txt>
              )}
            </div>
          )}
          {isCompleted && item.comment && (
            <div>
              <Txt variant="ui-xs" className="text-neutral3 mb-1 block font-semibold">
                Comment
              </Txt>
              <Txt variant="ui-xs" className="text-neutral4 block">
                {item.comment}
              </Txt>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
