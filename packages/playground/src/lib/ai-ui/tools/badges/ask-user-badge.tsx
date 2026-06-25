import { Icon, cn } from '@mastra/playground-ui';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Check, MessageCircleQuestion, Send } from 'lucide-react';
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
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [freeTextInput, setFreeTextInput] = useState('');

  const { question, options, selectionMode } = suspendPayload;
  const resolvedMode = options?.length ? (selectionMode ?? 'single_select') : undefined;
  const isAnswered = !!result || toolCallApprovals?.[toolCallId]?.status === 'approved';
  const subtitle = !options?.length
    ? 'free text'
    : resolvedMode === 'multi_select'
      ? 'multiple choice'
      : 'single choice';

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
    <div
      data-testid="ask-user-badge"
      className="mb-4 flex w-full max-w-full overflow-hidden rounded-lg border border-border1 bg-surface3"
    >
      <div className={cn('w-1 shrink-0', isAnswered ? 'bg-notice-success' : 'bg-accent1')} />

      <div className="min-w-0 flex-1">
        <div className="flex h-header-default items-center gap-2 border-b border-border1 px-4">
          <span className="rounded-md border border-border1 bg-surface4 p-1">
            <Icon>
              <MessageCircleQuestion className="text-icon3" />
            </Icon>
          </span>
          <Txt as="span" variant="ui-md" className="font-medium text-neutral6">
            Ask User
          </Txt>
          <Txt as="span" variant="ui-sm" className="text-neutral3">
            · {subtitle}
          </Txt>
          {isAnswered && (
            <Badge variant="success" size="sm" icon={<span className="size-1.5 rounded-full bg-current" />}>
              Answered
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-4 p-4">
          <Txt as="p" variant="ui-xs" className="uppercase tracking-wide text-neutral3">
            Question
          </Txt>
          <Txt as="p" variant="ui-lg" className="text-neutral6">
            {question}
          </Txt>

          {isAnswered && result != null && (
            <div className="flex items-center gap-2 rounded-md border border-border1 bg-surface4 px-3 py-2">
              <Icon>
                <Check className="text-notice-success-fg" />
              </Icon>
              <Txt as="span" variant="ui-md" className="font-medium text-neutral6">
                {result.content}
              </Txt>
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
                    className={cn(
                      'rounded-md border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      isSelected ? 'border-accent1 bg-surface4' : 'border-border1 bg-surface4 hover:bg-surface5',
                    )}
                  >
                    <Txt as="span" variant="ui-md" className="font-medium text-neutral6">
                      {option.label}
                    </Txt>
                    {option.description && (
                      <Txt as="span" variant="ui-xs" className="mt-0.5 block text-neutral3">
                        {option.description}
                      </Txt>
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
    </div>
  );
};
