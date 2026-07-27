import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ThumbsUp, ThumbsDown, Trash2, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { TagPicker } from './tag-picker';
import type { ReviewItem } from '@/domains/agents/context/review-queue-context';

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
  extraHeader,
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
  /** Optional extra content rendered in the header row (e.g., experiment/target info) */
  extraHeader?: React.ReactNode;
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

  const scoresEntries: Array<[string, number]> = item.scores
    ? (Object.entries(item.scores) as Array<[string, number]>)
    : [];

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
        {extraHeader}
      </div>

      {/* Error indicator */}
      {Boolean(item.error) && (
        <Txt variant="ui-xs" className="text-negative1 mt-1 block truncate">
          Error: {typeof item.error === 'string' ? item.error : 'Failed'}
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
              tooltip="Bad — this result is wrong"
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
              item.tags.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1">
                  {item.tags.map(t => (
                    <Badge key={t} variant="default">
                      {t}
                    </Badge>
                  ))}
                </div>
              ) : null
            ) : (
              <TagPicker tags={item.tags} vocabulary={tagVocabulary} onSetTags={onSetTags} />
            )}
          </div>

          {!isCompleted && (
            <>
              <Button
                tooltip={
                  item.tags.length > 0 || item.comment ? 'Mark as complete' : 'Add a tag or comment before completing'
                }
                variant="ghost"
                size="sm"
                onClick={onComplete}
                disabled={item.tags.length === 0 && !item.comment}
              >
                <Icon size="sm" className={item.tags.length > 0 || item.comment ? 'text-positive1' : 'text-neutral3'}>
                  <CheckCircle />
                </Icon>
              </Button>

              <Button tooltip="Delete from review queue" variant="ghost" size="sm" onClick={onRemove}>
                <Icon size="sm" className="text-neutral3">
                  <Trash2 />
                </Icon>
              </Button>
            </>
          )}
        </div>
      </TooltipProvider>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-border1 mt-3 space-y-2 border-t pt-2">
          {/* Scores */}
          {scoresEntries.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {scoresEntries.map(([scorerId, score]) => (
                <Badge key={scorerId} variant={score >= 0.5 ? 'success' : 'error'}>
                  {scorerId.slice(0, 12)}: {score.toFixed(3)}
                </Badge>
              ))}
            </div>
          )}

          {/* Input */}
          <div>
            <Txt variant="ui-xs" className="text-neutral3 mb-1 block font-medium">
              Input
            </Txt>
            <pre className="text-neutral4 bg-surface3 max-h-24 overflow-x-auto overflow-y-auto rounded px-3 py-2 text-xs wrap-break-word whitespace-pre-wrap">
              {formatUnknown(item.input)}
            </pre>
          </div>

          {/* Output / Error */}
          <div>
            <Txt variant="ui-xs" className="text-neutral3 mb-1 block font-medium">
              {item.error ? 'Error' : 'Output'}
            </Txt>
            <pre
              className={cn(
                'text-xs rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap wrap-break-word max-h-24 overflow-y-auto',
                item.error ? 'text-negative1 bg-negative1/10' : 'text-neutral4 bg-surface3',
              )}
            >
              {formatUnknown(item.error || item.output)}
            </pre>
          </div>

          {/* Comment */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Txt variant="ui-xs" className="text-neutral3 font-medium">
                Comment
              </Txt>
              {commentSaved && (
                <Txt variant="ui-xs" className="text-positive1">
                  Saved
                </Txt>
              )}
            </div>
            {isCompleted ? (
              item.comment ? (
                <Txt variant="ui-xs" className="text-neutral4">
                  {item.comment}
                </Txt>
              ) : (
                <Txt variant="ui-xs" className="text-neutral2 italic">
                  No comment
                </Txt>
              )
            ) : (
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
                    setTimeout(() => setCommentSaved(false), 2000);
                  }
                }}
                placeholder="What went wrong? How should this be handled?"
                rows={2}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
