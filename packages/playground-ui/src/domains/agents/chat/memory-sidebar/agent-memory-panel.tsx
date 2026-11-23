import { useMemoryConfig } from '@mastra/react/hooks/memory';
import type { ReactNode } from 'react';
import { getRecentMessagesSettings } from './recent-messages';
import { useEntityRequestContext } from '@/domains/request-context/hooks/use-entity-request-context';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { IconSquareArrowTopRight } from '@/ds/icons/central/IconSquareArrowTopRight';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { cn } from '@/utils/cn';

/**
 * Host-supplied memory sections. Each section a host does not supply is omitted,
 * so hosts without a backend for a capability never render its controls.
 */
export interface AgentMemoryPanelSections {
  clone?: ReactNode;
  observationalMemory?: ReactNode;
  /** Search UI shown when semantic recall is enabled; without it the section only reports its state. */
  semanticRecallSearch?: ReactNode;
  semanticRecallBadge?: ReactNode;
  workingMemory?: ReactNode;
}

export interface AgentMemoryPanelProps extends AgentMemoryPanelSections {
  agentId: string;
  memoryType?: 'local' | 'gateway';
  /** Hosts whose memory has no vector recall omit the Semantic Recall section entirely. Defaults to true. */
  supportsSemanticRecall?: boolean;
  /** Hosts whose memory has no recent-message window omit the Recent Messages section. Defaults to true. */
  supportsRecentMessages?: boolean;
}

function NotEnabledNotice({ children, href, linkLabel }: { children: ReactNode; href: string; linkLabel: string }) {
  return (
    <div className={cn(raisedSurfaceStyle, 'rounded-lg p-4')}>
      <Txt tone="muted" className="mb-3">
        {children}
      </Txt>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-2 text-info-indicator hover:underline',
          controlStateColorTransition,
        )}
      >
        <Txt as="span" variant="body" className="block">
          {linkLabel}
        </Txt>
        <IconSquareArrowTopRight className="size-icon-xs" />
      </a>
    </div>
  );
}

/** Expanded Memory card content shared by every agent host. */
export function AgentMemoryPanel({
  agentId,
  memoryType,
  clone,
  observationalMemory,
  semanticRecallSearch,
  semanticRecallBadge,
  workingMemory,
  supportsSemanticRecall = true,
  supportsRecentMessages = true,
}: AgentMemoryPanelProps) {
  const isGatewayMemory = memoryType === 'gateway';
  const [requestContext] = useEntityRequestContext('agent', agentId);
  const { data, isLoading } = useMemoryConfig({
    agentId,
    requestContext,
    queryOptions: { enabled: Boolean(agentId) },
  });
  const config = data?.config;
  const isSemanticRecallEnabled = Boolean(config?.semanticRecall);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      {clone && <div className="border-b border-border p-4">{clone}</div>}

      {supportsRecentMessages && (
        <div className="border-b border-border p-4">
          <Txt as="h3" variant="subheading" tone="ink">
            Recent Messages
          </Txt>
          <Txt variant="caption" tone="muted" className="mt-1">
            {getRecentMessagesSettings(config?.lastMessages, config?.messageHistory).description}
          </Txt>
        </div>
      )}

      {observationalMemory && (
        <div className="min-w-0 overflow-hidden border-b border-border">{observationalMemory}</div>
      )}

      {!isGatewayMemory && supportsSemanticRecall && (
        <div className="border-b border-border p-4">
          <div className="mb-2 flex items-center gap-2">
            <Txt as="h3" variant="subheading" tone="ink">
              Semantic Recall
            </Txt>
            {semanticRecallBadge}
          </div>
          {isSemanticRecallEnabled ? (
            (semanticRecallSearch ?? (
              <Txt variant="caption" tone="muted">
                Semantic recall is enabled for this agent.
              </Txt>
            ))
          ) : (
            <NotEnabledNotice
              href="https://mastra.ai/en/docs/memory/semantic-recall"
              linkLabel="Learn about semantic recall"
            >
              Semantic recall is not enabled for this agent. Enable it to search through conversation history.
            </NotEnabledNotice>
          )}
        </div>
      )}

      {!isGatewayMemory && workingMemory && <div>{workingMemory}</div>}

      {isGatewayMemory && (
        <div className="border-b border-border p-4">
          <div className={cn(raisedSurfaceStyle, 'rounded-lg p-4')}>
            <div className="mb-1 flex items-center gap-2">
              <Txt
                as="span"
                variant="column"
                className="rounded bg-badge-green-strong px-2 py-0.5 text-badge-green-foreground"
              >
                Remote
              </Txt>
              <Txt as="h3" variant="subheading" tone="ink">
                Gateway
              </Txt>
            </div>
            <Txt variant="caption" tone="muted">
              Memory is managed by the Gateway. Threads and observations are stored remotely.
            </Txt>
          </div>
        </div>
      )}
    </div>
  );
}
