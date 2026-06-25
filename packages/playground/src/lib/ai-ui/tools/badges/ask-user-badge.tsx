import { Icon, cn } from '@mastra/playground-ui';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Check, ChevronUpIcon, MessageCircleQuestion, Send } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { AskUserResult, AskUserSuspendPayload } from './types';
import { useToolCall } from '@/services/tool-call-provider';

export interface AskUserBadgeProps {
  toolCallId: string;
  suspendPayload: AskUserSuspendPayload;
  result: AskUserResult | undefined;
}

export const AskUserBadge = ({ toolCallId, suspendPayload, result }: AskUserBadgeProps) => {
  const { approveToolcall, isRunning, toolCallApprovals } = useToolCall();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [freeTextInput, setFreeTextInput] = useState('');

  const { question, options, selectionMode } = suspendPayload;
  const resolvedMode = options?.length ? (selectionMode ?? 'single_select') : undefined;
  const isAnswered = !!result || toolCallApprovals?.[toolCallId]?.status === 'approved';

  const handleOptionSelect = useCallback(
    (label: string) => {
      if (isAnswered || isRunning) return;
      if (resolvedMode === 'multi_select') {
        setSelectedOptions(prev => (prev.includes(label) ? prev.filter(o => o !== label) : [...prev, label]));
      } else {
        // Single-select: submit immediately
        approveToolcall(toolCallId, label);
      }
    },
    [isAnswered, isRunning, resolvedMode, approveToolcall, toolCallId],
  );

  const handleMultiSubmit = useCallback(() => {
    if (selectedOptions.length === 0 || isAnswered || isRunning) return;
    approveToolcall(toolCallId, selectedOptions);
  }, [selectedOptions, isAnswered, isRunning, approveToolcall, toolCallId]);

  const handleFreeTextSubmit = useCallback(() => {
    const trimmed = freeTextInput.trim();
    if (!trimmed || isAnswered || isRunning) return;
    approveToolcall(toolCallId, trimmed);
  }, [freeTextInput, isAnswered, isRunning, approveToolcall, toolCallId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleFreeTextSubmit();
      }
    },
    [handleFreeTextSubmit],
  );

  return (
    <div data-testid="ask-user-badge" className="mb-4 w-fit max-w-full">
      <button
        type="button"
        onClick={() => setIsCollapsed(s => !s)}
        className={cn(
          'flex items-center gap-2 px-2.5 h-badge-default text-ui-sm font-mono border border-border1 bg-surface4 transition-colors',
          isCollapsed ? 'rounded-full' : 'rounded-t-lg border-b-0',
        )}
      >
        <Icon>
          <ChevronUpIcon className={cn('transition-all', isCollapsed ? 'rotate-90' : 'rotate-180')} />
        </Icon>
        <Icon>
          <MessageCircleQuestion className="text-accent1" />
        </Icon>
        Question for you
      </button>

      {!isCollapsed && (
        <div className="p-4 rounded-b-lg rounded-tr-lg border border-border1 border-t-0 bg-surface4 flex flex-col gap-4">
          <div className="space-y-3">
            <p className="text-sm text-text1 font-medium">{question}</p>

            {isAnswered && result != null && (
              <div className="flex items-center gap-2 rounded-md bg-surface4 px-3 py-2">
                <Icon>
                  <Check className="text-accent1" />
                </Icon>
                <span className="text-sm text-text2">{result.content}</span>
              </div>
            )}

            {!isAnswered && options && options.length > 0 && (
              <div className="flex flex-col gap-2">
                {options.map(option => {
                  const isSelected = selectedOptions.includes(option.label);
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => handleOptionSelect(option.label)}
                      disabled={isRunning}
                      className={`
                    text-left px-3 py-2 rounded-md border transition-colors
                    ${isSelected ? 'border-accent1 bg-surface4' : 'border-border1 bg-surface3 hover:bg-surface4'}
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                    >
                      <span className="text-sm text-text1 font-medium">{option.label}</span>
                      {option.description && (
                        <span className="block text-xs text-text2 mt-0.5">{option.description}</span>
                      )}
                    </button>
                  );
                })}
                {resolvedMode === 'multi_select' && (
                  <Button onClick={handleMultiSubmit} disabled={selectedOptions.length === 0 || isRunning}>
                    <Icon>
                      <Send />
                    </Icon>
                    Submit ({selectedOptions.length} selected)
                  </Button>
                )}
              </div>
            )}

            {!isAnswered && !options?.length && (
              <div className="flex gap-2">
                <Input
                  placeholder="Type your answer..."
                  value={freeTextInput}
                  onChange={e => setFreeTextInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isRunning}
                  className="flex-1"
                />
                <Button onClick={handleFreeTextSubmit} disabled={!freeTextInput.trim() || isRunning}>
                  <Icon>
                    <Send />
                  </Icon>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
