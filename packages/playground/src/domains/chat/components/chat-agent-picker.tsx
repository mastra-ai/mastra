import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useAgents } from '@mastra/react/hooks/agents';
import { MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { SidebarSearchInput } from '@/components/ui/sidebar-search-input';
import { navCrumb } from '@/domains/navigation/crumbs';

export function ChatAgentPicker() {
  const { data: agents, isLoading, error } = useAgents();
  const [search, setSearch] = useState('');
  const { Link } = useLinkComponent();
  const visible = Object.entries(agents ?? {}).filter(([, agent]) =>
    agent.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={[navCrumb('/chat')]} />}>
      <div className="mx-auto grid w-full max-w-4xl gap-6">
        <div>
          <Txt as="h1" variant="title">
            Choose an agent to chat with
          </Txt>
          <Txt tone="muted">Pick up a conversation or start something new.</Txt>
        </div>
        <SidebarSearchInput
          value={search}
          label="Search agents"
          onValueChange={setSearch}
          placeholder="Search agents…"
        />
        {isLoading && <Spinner aria-label="Loading agents" />}
        {error && <EmptyState tone="error" titleSlot="Could not load agents" descriptionSlot={error.message} />}
        {!isLoading && !error && !visible.length && <EmptyState titleSlot="No agents found" />}
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map(([id, agent]) => (
            <Link
              key={id}
              href={`/chat/${encodeURIComponent(id)}`}
              className="hover:bg-accent flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-4 focus-visible:outline focus-visible:outline-2"
            >
              <AgentIcon className="size-5 shrink-0" />
              <Txt className="min-w-0 flex-1 truncate">{agent.name}</Txt>
              <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
