import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { DataKeysAndValues } from '@mastra/playground-ui/components/DataKeysAndValues';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { CheckCircle, FileInputIcon, FileOutputIcon, GaugeIcon, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type { ReviewItem } from './review-item-card';
import { TagPicker } from './tag-picker';
function formatUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export interface ReviewItemPanelProps {
  item: ReviewItem;
  isCompleted?: boolean;
  tagVocabulary: string[];
  onRate: (rating: 'positive' | 'negative' | undefined) => void;
  onSetTags: (tags: string[]) => void;
  onComment: (comment: string) => void;
  onRemove: () => void;
  onComplete?: () => void | Promise<void>;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
}

export function ReviewItemPanel({
  item,
  isCompleted,
  tagVocabulary,
  onRate,
  onSetTags,
  onComment,
  onRemove,
  onComplete,
  onPrevious,
  onNext,
  onClose,
}: ReviewItemPanelProps) {
  const [localComment, setLocalComment] = useState(item.comment || '');
  const [commentSaved, setCommentSaved] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  useEffect(() => {
    setLocalComment(item.comment || '');
    setCommentSaved(false);
    setShowRemoveConfirm(false);
    // Intentionally depends on item.id only — re-running on every new `item` object
    // reference would clobber the user's in-progress comment edit on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const commentTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(commentTimerRef.current), []);

  const handleCommentBlur = () => {
    if (localComment !== (item.comment || '')) {
      onComment(localComment);
      setCommentSaved(true);
      clearTimeout(commentTimerRef.current);
      commentTimerRef.current = setTimeout(() => setCommentSaved(false), 1500);
    }
  };

  return (
    <>
      <DataPanel>
        <DataPanel.Header>
          <DataPanel.Heading>Review</DataPanel.Heading>
          <ButtonsGroup className="ml-auto shrink-0">
            <DataPanel.NextPrevNav
              onPrevious={onPrevious}
              onNext={onNext}
              previousLabel="Previous item"
              nextLabel="Next item"
            />
            {!isCompleted && onComplete && (
              <Button size="md" onClick={onComplete} aria-label="Mark as complete">
                <CheckCircle />
                Complete
              </Button>
            )}
            <DataPanel.CloseButton onClick={onClose} tooltip="Close detail panel" />
          </ButtonsGroup>
        </DataPanel.Header>

        <DataPanel.Content>
          <div className="mb-6 grid gap-4">
            {/* Rating */}
            {!isCompleted && (
              <div className="flex items-center gap-2">
                <Txt variant="ui-sm" className="text-neutral3">
                  Rating
                </Txt>
                <ButtonsGroup spacing="close">
                  <Button
                    size="md"
                    onClick={() => onRate(item.rating === 'positive' ? undefined : 'positive')}
                    aria-label="Rate positive"
                  >
                    <Icon size="sm" className={item.rating === 'positive' ? 'text-positive1' : ''}>
                      <ThumbsUp />
                    </Icon>
                  </Button>
                  <Button
                    size="md"
                    onClick={() => onRate(item.rating === 'negative' ? undefined : 'negative')}
                    aria-label="Rate negative"
                  >
                    <Icon size="sm" className={item.rating === 'negative' ? 'text-negative1' : ''}>
                      <ThumbsDown />
                    </Icon>
                  </Button>
                </ButtonsGroup>
                {item.rating && (
                  <Badge variant={item.rating === 'positive' ? 'success' : 'error'}>
                    {item.rating === 'positive' ? 'Good' : 'Bad'}
                  </Badge>
                )}
              </div>
            )}

            {isCompleted && item.rating && (
              <div className="flex items-center gap-2">
                <Txt variant="ui-sm" className="text-neutral3">
                  Rating
                </Txt>
                <Badge variant={item.rating === 'positive' ? 'success' : 'error'}>
                  {item.rating === 'positive' ? 'Good' : 'Bad'}
                </Badge>
              </div>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              <Txt variant="ui-sm" className="text-neutral3 mt-0 block">
                Tags
              </Txt>
              {isCompleted ? (
                <div className="flex flex-wrap gap-1">
                  {item.tags.length > 0 ? (
                    item.tags.map(tag => (
                      <Badge key={tag} variant="default">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <Txt variant="ui-sm" className="text-neutral2">
                      No tags
                    </Txt>
                  )}
                </div>
              ) : (
                <TagPicker tags={item.tags} vocabulary={tagVocabulary} onSetTags={onSetTags} />
              )}
            </div>

            {/* Scores */}
            {item.scores && Object.keys(item.scores).length > 0 && (
              <div>
                <Txt variant="ui-xs" className="text-neutral3 mb-2 block">
                  Scores
                </Txt>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(item.scores).map(([name, score]) => (
                    <div key={name} className="flex items-center gap-1">
                      <Icon size="sm" className="text-neutral3">
                        <GaugeIcon />
                      </Icon>
                      <Txt variant="ui-xs" className="text-neutral4">
                        {name}:
                      </Txt>
                      <Badge variant={score >= 0.5 ? 'success' : 'error'}>{score.toFixed(3)}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {item.experimentId && (
              <DataKeysAndValues>
                <DataKeysAndValues.Key>Experiment Id</DataKeysAndValues.Key>
                <DataKeysAndValues.ValueWithCopyBtn
                  copyTooltip="Copy Experiment Id to clipboard"
                  copyValue={item.experimentId}
                >
                  {item.experimentId}
                </DataKeysAndValues.ValueWithCopyBtn>
              </DataKeysAndValues>
            )}
          </div>

          <div className="grid gap-3">
            <DataPanel.CodeSection title="Input" icon={<FileInputIcon />} codeStr={formatUnknown(item.input ?? null)} />
            <DataPanel.CodeSection
              title="Output"
              icon={<FileOutputIcon />}
              codeStr={formatUnknown(item.output ?? null)}
            />
          </div>

          {/* Error */}
          {item.error != null && (
            <div>
              <Txt variant="ui-xs" className="text-neutral3 mb-1 block">
                Error
              </Txt>
              <pre className="text-ui-xs text-negative1 bg-surface2 max-h-48 overflow-auto rounded-md p-3 wrap-break-word whitespace-pre-wrap">
                {formatUnknown(item.error)}
              </pre>
            </div>
          )}

          {/* Comment */}
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2">
              <Txt variant="ui-sm" className="text-neutral2 tracking-widest uppercase">
                Comment
              </Txt>
              {commentSaved && (
                <Txt variant="ui-xs" className="text-positive1">
                  Saved
                </Txt>
              )}
            </div>
            {isCompleted ? (
              <Txt variant="ui-xs" className="text-neutral4 block">
                {item.comment || 'No comment'}
              </Txt>
            ) : (
              <Textarea
                value={localComment}
                onChange={e => setLocalComment(e.target.value)}
                onBlur={handleCommentBlur}
                placeholder="Add notes about this item..."
                rows={3}
                className="text-xs"
              />
            )}
          </div>

          {/* Actions */}
          {!isCompleted && (
            <div className="border-border1 mt-4 flex items-center gap-2 border-t pt-4">
              {onComplete && (
                <Button size="md" onClick={onComplete}>
                  <CheckCircle />
                  Mark as complete
                </Button>
              )}
              <Button variant="outline" size="md" onClick={() => setShowRemoveConfirm(true)}>
                <Trash2 />
                Remove
              </Button>
            </div>
          )}
        </DataPanel.Content>
      </DataPanel>

      <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Remove from Review</AlertDialog.Title>
            <AlertDialog.Description>
              This will remove the item from the review queue. The experiment result will remain but will no longer be
              flagged for review.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={() => {
                onRemove();
                setShowRemoveConfirm(false);
              }}
            >
              Remove
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
}
