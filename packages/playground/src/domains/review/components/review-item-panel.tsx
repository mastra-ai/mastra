import {
  AlertDialog,
  Badge,
  Button,
  ButtonsGroup,
  Column,
  PrevNextNav,
  Textarea,
  Txt,
  Icon,
} from '@mastra/playground-ui';
import { ThumbsUp, ThumbsDown, Trash2, CheckCircle, XIcon, GaugeIcon } from 'lucide-react';
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
      <Column withLeftSeparator>
        <Column.Toolbar>
          <PrevNextNav
            onPrevious={onPrevious}
            onNext={onNext}
            previousAriaLabel="Previous item"
            nextAriaLabel="Next item"
          />
          <ButtonsGroup>
            {!isCompleted && onComplete && (
              <Button onClick={onComplete} aria-label="Mark as complete">
                <CheckCircle />
                Complete
              </Button>
            )}
            <Button onClick={onClose} aria-label="Close detail panel">
              <XIcon />
            </Button>
          </ButtonsGroup>
        </Column.Toolbar>

        <Column.Content>
          {/* Rating */}
          {!isCompleted && (
            <div className="flex items-center gap-2">
              <Txt variant="ui-xs" className="text-neutral3">
                Rating
              </Txt>
              <div className="flex items-center gap-1">
                <Button
                  variant={item.rating === 'positive' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onRate(item.rating === 'positive' ? undefined : 'positive')}
                  aria-label="Rate positive"
                >
                  <Icon size="sm" className={item.rating === 'positive' ? 'text-positive1' : ''}>
                    <ThumbsUp />
                  </Icon>
                </Button>
                <Button
                  variant={item.rating === 'negative' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onRate(item.rating === 'negative' ? undefined : 'negative')}
                  aria-label="Rate negative"
                >
                  <Icon size="sm" className={item.rating === 'negative' ? 'text-negative1' : ''}>
                    <ThumbsDown />
                  </Icon>
                </Button>
              </div>
              {item.rating && (
                <Badge variant={item.rating === 'positive' ? 'success' : 'error'}>
                  {item.rating === 'positive' ? 'Good' : 'Bad'}
                </Badge>
              )}
            </div>
          )}

          {isCompleted && item.rating && (
            <div className="flex items-center gap-2">
              <Txt variant="ui-xs" className="text-neutral3">
                Rating
              </Txt>
              <Badge variant={item.rating === 'positive' ? 'success' : 'error'}>
                {item.rating === 'positive' ? 'Good' : 'Bad'}
              </Badge>
            </div>
          )}

          {/* Tags */}
          <div>
            <Txt variant="ui-xs" className="text-neutral3 block mb-2">
              Tags
            </Txt>
            {isCompleted ? (
              <div className="flex gap-1 flex-wrap">
                {item.tags.length > 0 ? (
                  item.tags.map(tag => (
                    <Badge key={tag} variant="default">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <Txt variant="ui-xs" className="text-neutral2">
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
              <Txt variant="ui-xs" className="text-neutral3 block mb-2">
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

          {/* Experiment ID */}
          {item.experimentId && (
            <div>
              <Txt variant="ui-xs" className="text-neutral3 block mb-1">
                Experiment
              </Txt>
              <Txt variant="ui-xs" className="text-neutral4 font-mono">
                {item.experimentId}
              </Txt>
            </div>
          )}

          {/* Input */}
          <div>
            <Txt variant="ui-xs" className="text-neutral3 block mb-1">
              Input
            </Txt>
            <pre className="text-ui-xs text-neutral4 whitespace-pre-wrap break-words bg-surface2 rounded-md p-3 max-h-48 overflow-auto">
              {formatUnknown(item.input)}
            </pre>
          </div>

          {/* Output */}
          {item.output != null && (
            <div>
              <Txt variant="ui-xs" className="text-neutral3 block mb-1">
                Output
              </Txt>
              <pre className="text-ui-xs text-neutral4 whitespace-pre-wrap break-words bg-surface2 rounded-md p-3 max-h-48 overflow-auto">
                {formatUnknown(item.output)}
              </pre>
            </div>
          )}

          {/* Error */}
          {item.error != null && (
            <div>
              <Txt variant="ui-xs" className="text-neutral3 block mb-1">
                Error
              </Txt>
              <pre className="text-ui-xs text-negative1 whitespace-pre-wrap break-words bg-surface2 rounded-md p-3 max-h-48 overflow-auto">
                {formatUnknown(item.error)}
              </pre>
            </div>
          )}

          {/* Comment */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Txt variant="ui-xs" className="text-neutral3">
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
            <div className="flex items-center gap-2 pt-2 border-t border-border1">
              {onComplete && (
                <Button size="sm" onClick={onComplete}>
                  <Icon size="sm">
                    <CheckCircle />
                  </Icon>
                  Mark as complete
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowRemoveConfirm(true)}>
                <Icon size="sm">
                  <Trash2 />
                </Icon>
                Remove
              </Button>
            </div>
          )}
        </Column.Content>
      </Column>

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
