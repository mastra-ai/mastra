import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useMastraClient } from '@mastra/react';
import { useMemory } from '@mastra/react/hooks/memory';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { ContextualSidebarSection } from '@/components/ui/contextual-sidebar-section';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

export function AgentRecentChats({ agentId }: { agentId: string }) {
  const { hasPermission, isLoading } = usePermissions();
  if (isLoading || !hasPermission('memory:read')) return null;
  return <RecentChats agentId={agentId} />;
}

function RecentChats({ agentId }: { agentId: string }) {
  const client = useMastraClient();
  const { Link, paths } = useLinkComponent();
  const [requestContext] = useEntityRequestContext('agent', agentId);
  const memory = useMemory({ agentId, requestContext });
  const threads = useQuery({
    queryKey: ['memory', 'threads', agentId, agentId, requestContext, 'recent'],
    queryFn: () =>
      client.listMemoryThreads({
        agentId,
        resourceId: agentId,
        requestContext,
        page: 0,
        perPage: 3,
        orderBy: { field: 'updatedAt', direction: 'DESC' },
      }),
    enabled: Boolean(memory.data?.result),
  });
  const loading = memory.isLoading || (memory.data?.result && threads.isLoading);
  const error = memory.error || threads.error;
  return (
    <section aria-label="Recent chats" className="shrink-0 border-b border-border">
      <ContextualSidebarSection>
        <Txt as="h2" variant="meta" tone="muted" className="px-3 py-2">
          Recent chats
        </Txt>
        {loading ? (
          <Skeleton className="mx-3 h-16" />
        ) : error ? (
          <div className="px-3">
            <Txt variant="caption" tone="muted">
              Could not load recent chats.
            </Txt>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void memory.refetch();
                void threads.refetch();
              }}
            >
              Retry
            </Button>
          </div>
        ) : !memory.data?.result ? (
          <Txt variant="caption" tone="muted" className="px-3 pb-2">
            Enable memory to keep conversations with this agent.
          </Txt>
        ) : threads.data?.threads.length ? (
          <nav aria-label="Recent agent conversations" className="grid gap-1">
            {threads.data.threads.slice(0, 3).map(thread => (
              <Link
                key={thread.id}
                href={paths.agentThreadLink(agentId, thread.id)}
                className="text-ui-sm hover:bg-accent flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 focus-visible:outline-2 focus-visible:outline-border-focus"
              >
                <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{thread.title || 'Untitled conversation'}</span>
              </Link>
            ))}
          </nav>
        ) : (
          <Txt variant="caption" tone="muted" className="px-3 pb-2">
            No conversations with this agent yet.
          </Txt>
        )}
      </ContextualSidebarSection>
    </section>
  );
}
