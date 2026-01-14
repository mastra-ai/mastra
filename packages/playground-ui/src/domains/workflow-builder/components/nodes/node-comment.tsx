import { useState, useCallback, useRef, useEffect } from 'react';
import { MessageSquare, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';

// ============================================================================
// Props
// ============================================================================

export interface NodeCommentProps {
  nodeId: string;
  comment?: string;
  /** Position relative to the node */
  position?: 'top' | 'bottom';
  /** Compact mode just shows an indicator */
  compact?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function NodeComment({ nodeId, comment, position = 'bottom', compact = true }: NodeCommentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localComment, setLocalComment] = useState(comment || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateNodeData = useWorkflowBuilderStore(state => state.updateNodeData);

  // Sync local state when prop changes
  useEffect(() => {
    setLocalComment(comment || '');
  }, [comment]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    updateNodeData(nodeId, { comment: localComment.trim() || undefined });
    setIsEditing(false);
  }, [nodeId, localComment, updateNodeData]);

  const handleCancel = useCallback(() => {
    setLocalComment(comment || '');
    setIsEditing(false);
  }, [comment]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel],
  );

  // Position styles
  const positionStyles = {
    top: '-top-2 -translate-y-full',
    bottom: '-bottom-2 translate-y-full',
  };

  // Compact mode: just show an icon if there's a comment
  if (compact && !isEditing) {
    if (!comment) {
      return (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className={cn(
            'absolute left-2 z-10',
            positionStyles[position],
            'p-1.5 rounded-full',
            'bg-surface4 hover:bg-surface3 border border-border1',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'text-icon3 hover:text-icon4',
          )}
          title="Add comment"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        className={cn(
          'absolute left-2 z-10',
          positionStyles[position],
          'max-w-[200px] px-2 py-1 rounded-md',
          'bg-amber-500/20 border border-amber-500/30',
          'text-left',
        )}
        title={comment}
      >
        <div className="flex items-start gap-1.5">
          <MessageSquare className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
          <span className="text-[10px] text-amber-300 line-clamp-2">{comment}</span>
        </div>
      </button>
    );
  }

  // Editing mode: show textarea
  if (isEditing) {
    return (
      <div
        className={cn(
          'absolute left-0 z-20',
          positionStyles[position],
          'w-[250px] bg-surface2 border border-border1 rounded-lg shadow-lg',
          'p-2',
        )}
        onClick={e => e.stopPropagation()}
      >
        <Textarea
          ref={textareaRef}
          value={localComment}
          onChange={e => setLocalComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment..."
          className="min-h-[60px] text-xs resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-icon3">
            {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to save
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={handleCancel} className="p-1 hover:bg-surface4 rounded text-icon3">
              <X className="w-4 h-4" />
            </button>
            <button type="button" onClick={handleSave} className="p-1 hover:bg-surface4 rounded text-green-400">
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Non-compact mode with comment
  if (comment) {
    return (
      <div
        className={cn(
          'absolute left-0 z-10',
          positionStyles[position],
          'max-w-[250px] px-3 py-2 rounded-lg',
          'bg-amber-500/10 border border-amber-500/30',
        )}
        onClick={e => {
          e.stopPropagation();
          setIsEditing(true);
        }}
      >
        <div className="flex items-start gap-2">
          <MessageSquare className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200">{comment}</p>
        </div>
      </div>
    );
  }

  return null;
}

// ============================================================================
// Comment Badge (for toolbar/sidebar)
// ============================================================================

export interface CommentBadgeProps {
  count: number;
  onClick?: () => void;
}

export function CommentBadge({ count, onClick }: CommentBadgeProps) {
  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded',
        'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20',
        'transition-colors',
      )}
    >
      <MessageSquare className="w-3.5 h-3.5" />
      <span className="text-xs">
        {count} comment{count !== 1 ? 's' : ''}
      </span>
    </button>
  );
}
