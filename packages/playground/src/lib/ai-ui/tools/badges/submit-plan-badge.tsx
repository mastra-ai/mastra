import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { CheckIcon, ClipboardList, CopyIcon, Maximize2, MessageSquareText, Minimize2, XIcon } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SubmitPlanResult, SubmitPlanResumeData, SubmitPlanSuspendPayload } from './types';
import { useToolCall } from '@/services/tool-call-provider';

const COLLAPSED_PLAN_HEIGHT = 220;

export interface SubmitPlanBadgeProps {
  toolCallId: string;
  suspendPayload: SubmitPlanSuspendPayload;
  result: SubmitPlanResult | undefined;
}

const getFileName = (path: string) => {
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? path;
};

const renderTitle = (title: string) =>
  title.split(/(`[^`]+`)/g).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={`${part}-${index}`} className="rounded-md bg-surface3 px-1.5 py-0.5 font-mono text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }

    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });

type SubmitPlanStatus = SubmitPlanResumeData['action'] | 'resolved';

const getSubmitPlanStatus = (result: SubmitPlanResult | undefined): SubmitPlanStatus | undefined => {
  if (!result) return undefined;
  if (result.action === 'approved' || result.action === 'rejected') return result.action;
  if (result.content.startsWith('Plan approved')) return 'approved';
  if (result.content.startsWith('Plan was not approved')) return 'rejected';
  return 'resolved';
};

export const SubmitPlanBadge = ({ toolCallId, suspendPayload, result }: SubmitPlanBadgeProps) => {
  const { approveToolcall, isRunning, toolCallApprovals } = useToolCall();
  const [comment, setComment] = useState('');
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const planContentRef = useRef<HTMLDivElement>(null);
  const { isCopied, copyToClipboard } = useCopyToClipboard({ copiedDuration: 1500, showToast: false });

  const { path, title, plan } = suspendPayload;
  const resolvedTitle = title ?? 'Submitted plan';
  const fileName = path ? getFileName(path) : undefined;
  const trimmedComment = comment.trim();
  const isResolved = !!result || toolCallApprovals?.[toolCallId]?.status === 'approved';
  const status = getSubmitPlanStatus(result);
  const statusLabel = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Resolved';
  const statusVariant = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'default';

  const sharedResumeData = useMemo(
    () => ({
      ...(path !== undefined ? { path } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(plan !== undefined ? { plan } : {}),
    }),
    [path, plan, title],
  );

  const copyContent = useMemo(
    () =>
      [resolvedTitle, path ? `File: ${path}` : undefined, plan]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join('\n\n'),
    [path, plan, resolvedTitle],
  );

  const buildResumeData = useCallback(
    (action: SubmitPlanResumeData['action'], feedbackValue?: string): SubmitPlanResumeData => ({
      action,
      ...sharedResumeData,
      ...(feedbackValue ? { feedback: feedbackValue } : {}),
    }),
    [sharedResumeData],
  );

  const handleApprove = useCallback(() => {
    if (isResolved || isRunning) return;
    approveToolcall(toolCallId, buildResumeData('approved', trimmedComment));
  }, [approveToolcall, buildResumeData, isResolved, isRunning, toolCallId, trimmedComment]);

  const handleReject = useCallback(() => {
    if (isResolved || isRunning) return;
    approveToolcall(toolCallId, buildResumeData('rejected', trimmedComment));
  }, [approveToolcall, buildResumeData, isResolved, isRunning, toolCallId, trimmedComment]);

  const handleCopy = useCallback(() => {
    copyToClipboard(copyContent);
  }, [copyContent, copyToClipboard]);

  const toggleExpanded = useCallback(() => {
    if (!canExpand) return;
    setIsExpanded(current => !current);
  }, [canExpand]);

  useEffect(() => {
    const content = planContentRef.current;
    if (!content) return;

    const measure = () => {
      setCanExpand(content.scrollHeight > COLLAPSED_PLAN_HEIGHT);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measure);
    observer.observe(content);

    return () => observer.disconnect();
  }, [path, plan]);

  const shouldClipContent = canExpand && !isExpanded;
  const hasDecisionControls = !isResolved;
  const showPlanControls = canExpand || hasDecisionControls;
  const isContentClickable = shouldClipContent;

  return (
    <div data-testid="submit-plan-badge" className="mb-4 w-full max-w-full overflow-hidden rounded-xl bg-surface3">
      <div className="flex min-h-10 items-center justify-between gap-3 px-4 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon size="sm" className="text-icon3">
            <ClipboardList />
          </Icon>
          <Txt as="span" variant="ui-sm" className="text-neutral4">
            Plan
          </Txt>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isResolved && (
            <Badge variant={statusVariant} size="xs" icon={<span className="size-1 rounded-full bg-current" />}>
              {statusLabel}
            </Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            tooltip="Copy plan"
            aria-label="Copy plan"
            onClick={handleCopy}
          >
            {isCopied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </div>
      </div>

      <div className="px-5 pb-5 pt-4">
        <div className="mb-5 space-y-1">
          <Txt as="h3" variant="header-sm" className="font-semibold text-neutral7">
            {renderTitle(resolvedTitle)}
          </Txt>
          {fileName && (
            <Txt
              as="p"
              variant="ui-xs"
              font="mono"
              title={path}
              className="max-w-full overflow-hidden whitespace-nowrap text-neutral3"
              style={{
                WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 28px), transparent)',
                maskImage: 'linear-gradient(to right, black calc(100% - 28px), transparent)',
              }}
            >
              {fileName}
            </Txt>
          )}
        </div>

        <div className="relative">
          <div
            data-testid="submit-plan-content"
            role={isContentClickable ? 'button' : undefined}
            tabIndex={isContentClickable ? 0 : undefined}
            aria-label={isContentClickable ? 'Expand plan' : undefined}
            onClick={isContentClickable ? toggleExpanded : undefined}
            onKeyDown={
              isContentClickable
                ? event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleExpanded();
                    }
                  }
                : undefined
            }
            className={cn(
              'relative outline-none',
              shouldClipContent && 'max-h-[220px] overflow-hidden pb-16',
              isContentClickable && 'cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-border2',
            )}
          >
            <div ref={planContentRef}>
              {plan ? (
                <div className="text-neutral6 [&_code]:bg-surface3 [&_h1]:text-header-md [&_h1]:leading-header-md [&_h2]:text-header-sm [&_h2]:leading-header-sm [&_h3]:text-ui-lg [&_h3]:leading-ui-lg [&_p]:text-ui-md [&_p]:leading-6">
                  <MarkdownRenderer>{plan}</MarkdownRenderer>
                </div>
              ) : path ? (
                <div>
                  <Txt as="p" variant="ui-xs" className="mb-2 uppercase tracking-wide text-neutral3">
                    Plan file
                  </Txt>
                  <Txt as="p" variant="ui-sm" className="break-all font-mono text-neutral6">
                    {path}
                  </Txt>
                </div>
              ) : null}
            </div>

            {shouldClipContent && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent via-surface3/90 to-surface3"
              />
            )}
          </div>

          {showPlanControls && (
            <div
              className={cn(
                'relative z-10 flex justify-center',
                shouldClipContent ? '-mt-14 pb-1' : 'mt-4',
                !isResolved && 'px-10',
              )}
              onClick={event => event.stopPropagation()}
            >
              <div
                className={cn(
                  'grid w-full max-w-sm grid-cols-[1fr_auto_1fr] items-center gap-2',
                  isResolved && 'max-w-max',
                )}
              >
                <div className="flex justify-end">
                  {!isResolved && (
                    <Button
                      type="button"
                      variant="primary"
                      size="icon-sm"
                      tooltip="Reject plan"
                      aria-label="Reject plan"
                      onClick={handleReject}
                      disabled={isRunning}
                    >
                      <XIcon />
                    </Button>
                  )}
                </div>

                {canExpand ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    aria-label={isExpanded ? 'Collapse plan' : 'Expand plan'}
                    onClick={toggleExpanded}
                  >
                    {isExpanded ? <Minimize2 /> : <Maximize2 />}
                    {isExpanded ? 'Collapse plan' : 'Expand plan'}
                  </Button>
                ) : (
                  <span aria-hidden="true" />
                )}

                <div className="flex justify-start gap-2">
                  {!isResolved && (
                    <>
                      <Popover open={isCommentOpen} onOpenChange={setIsCommentOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="primary"
                            size="icon-sm"
                            tooltip={trimmedComment ? 'Edit comment' : 'Add comment'}
                            aria-label={trimmedComment ? 'Edit comment' : 'Add comment'}
                            aria-pressed={isCommentOpen}
                            disabled={isRunning}
                          >
                            <MessageSquareText />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent side="top" align="end" sideOffset={8} className="w-72 p-3">
                          <Textarea
                            placeholder="Add an optional comment..."
                            value={comment}
                            onChange={event => setComment(event.target.value)}
                            disabled={isRunning}
                            rows={3}
                            variant="outline"
                            size="sm"
                            className="min-h-20 resize-y rounded-lg bg-surface1"
                          />
                          <div className="mt-2 flex justify-end">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => setIsCommentOpen(false)}
                              disabled={isRunning}
                            >
                              Done
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Button
                        type="button"
                        variant="primary"
                        size="icon-sm"
                        tooltip="Approve plan"
                        aria-label="Approve plan"
                        onClick={handleApprove}
                        disabled={isRunning}
                      >
                        <CheckIcon />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
