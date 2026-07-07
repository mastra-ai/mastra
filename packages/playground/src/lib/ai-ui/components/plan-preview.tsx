import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { CheckIcon, ClipboardList, CopyIcon, Maximize2, Minimize2 } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode } from 'react';

const DEFAULT_COLLAPSED_HEIGHT = 220;

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

export interface PlanPreviewStatus {
  label: ReactNode;
  variant?: BadgeVariant;
}

export interface PlanPreviewProps extends Omit<ComponentProps<'div'>, 'title'> {
  title: string;
  label?: ReactNode;
  path?: string;
  plan?: string;
  status?: PlanPreviewStatus;
  copyContent?: string;
  leftActions?: ReactNode;
  rightActions?: ReactNode;
  collapsedHeight?: number;
  contentTestId?: string;
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

export const PlanPreview = ({
  title,
  label = 'Plan',
  path,
  plan,
  status,
  copyContent,
  leftActions,
  rightActions,
  collapsedHeight = DEFAULT_COLLAPSED_HEIGHT,
  contentTestId = 'plan-preview-content',
  className,
  ...props
}: PlanPreviewProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { isCopied, copyToClipboard } = useCopyToClipboard({ copiedDuration: 1500, showToast: false });

  const fileName = useMemo(() => (path ? getFileName(path) : undefined), [path]);
  const hasActions = !!leftActions || !!rightActions;
  const shouldClipContent = canExpand && !isExpanded;
  const showControls = canExpand || hasActions;
  const isContentClickable = shouldClipContent;

  const handleCopy = useCallback(() => {
    if (!copyContent) return;
    copyToClipboard(copyContent);
  }, [copyContent, copyToClipboard]);

  const toggleExpanded = useCallback(() => {
    if (!canExpand) return;
    setIsExpanded(current => !current);
  }, [canExpand]);

  const handleContentKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggleExpanded();
    },
    [toggleExpanded],
  );

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const measure = () => {
      setCanExpand(content.scrollHeight > collapsedHeight);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measure);
    observer.observe(content);

    return () => observer.disconnect();
  }, [collapsedHeight, path, plan]);

  return (
    <div
      data-slot="plan-preview"
      className={cn('w-full max-w-full overflow-hidden rounded-xl bg-surface3', className)}
      {...props}
    >
      <div data-slot="plan-preview-header" className="flex min-h-10 items-center justify-between gap-3 px-4 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon size="sm" className="text-icon3">
            <ClipboardList />
          </Icon>
          <Txt as="span" variant="ui-sm" className="text-neutral4">
            {label}
          </Txt>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {status && (
            <Badge
              variant={status.variant ?? 'default'}
              size="xs"
              icon={<span className="size-1 rounded-full bg-current" />}
            >
              {status.label}
            </Badge>
          )}
          {copyContent && (
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
          )}
        </div>
      </div>

      <div data-slot="plan-preview-body" className="px-5 pb-5 pt-4">
        <div className="mb-5 space-y-1">
          <Txt as="h3" variant="header-sm" className="font-semibold text-neutral7">
            {renderTitle(title)}
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
            data-slot="plan-preview-content"
            data-testid={contentTestId}
            role={isContentClickable ? 'button' : undefined}
            tabIndex={isContentClickable ? 0 : undefined}
            aria-label={isContentClickable ? 'Expand plan' : undefined}
            onClick={isContentClickable ? toggleExpanded : undefined}
            onKeyDown={isContentClickable ? handleContentKeyDown : undefined}
            className={cn(
              'relative outline-none',
              shouldClipContent && 'overflow-hidden pb-16',
              isContentClickable && 'cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-border2',
            )}
            style={shouldClipContent ? { maxHeight: collapsedHeight } : undefined}
          >
            <div ref={contentRef}>
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

          {showControls && (
            <div
              data-slot="plan-preview-controls"
              className={cn('relative z-10 flex justify-center', shouldClipContent ? '-mt-14 pb-1' : 'mt-4')}
              onClick={event => event.stopPropagation()}
            >
              <div
                className={cn(
                  'grid w-full max-w-sm grid-cols-[1fr_auto_1fr] items-center gap-2',
                  !hasActions && 'max-w-max',
                  hasActions && 'px-10',
                )}
              >
                <div className="flex justify-end">{leftActions}</div>

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

                <div className="flex justify-start gap-2">{rightActions}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
