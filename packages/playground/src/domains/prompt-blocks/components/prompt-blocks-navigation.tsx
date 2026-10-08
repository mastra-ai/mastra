import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useStoredPromptBlocks } from '@mastra/react/hooks/prompt-blocks';
import { ChevronRight, List, MessageSquare, Plus } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { ContextualSidebarHeader } from '@/components/ui/contextual-sidebar-header';
import { ContextualSidebarLayout } from '@/components/ui/contextual-sidebar-layout';
import { ContextualSidebarSection } from '@/components/ui/contextual-sidebar-section';
import { NavigationQueryState } from '@/components/ui/navigation-query-state';
import { SidebarSearchInput } from '@/components/ui/sidebar-search-input';
import { SidebarSlot } from '@/components/ui/sidebar-slot';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';

export function PromptBlocksNavigation() {
  const { promptBlockId } = useParams();
  const { pathname } = useLocation();
  const isCollection = pathname === '/prompts';
  const [search, setSearch] = useState('');
  const { data, isLoading, error, isFetching } = useStoredPromptBlocks({ page: 0, perPage: 50 });
  const { paths } = useLinkComponent();
  const { isCmsAvailable } = useIsCmsAvailable();
  const term = search.trim().toLowerCase();
  const blocks = (data?.promptBlocks ?? []).filter(block => block.name.toLowerCase().includes(term));

  return (
    <ContextualSidebarLayout
      label="Prompt navigation"
      header={
        <div className="shrink-0">
          <ContextualSidebarHeader>
            <Txt variant="subheading" className="px-3">
              Prompts
            </Txt>
          </ContextualSidebarHeader>
        </div>
      }
    >
      <div className="shrink-0 border-b border-border">
        <ContextualSidebarSection>
          <Sidebar.NavList>
            <Sidebar.NavLink
              state="default"
              link={{ name: 'All prompts', url: paths.promptBlocksLink(), icon: <List /> }}
              isActive={isCollection}
            />
            {isCmsAvailable && (
              <Sidebar.NavLink
                state="default"
                link={{ name: 'Create prompt', url: paths.cmsPromptBlockCreateLink(), icon: <Plus /> }}
                isActive={pathname === '/cms/prompts/create'}
              />
            )}
          </Sidebar.NavList>
        </ContextualSidebarSection>
      </div>
      <Collapsible
        defaultOpen
        className={
          isCollection ? 'flex min-h-0 flex-1 flex-col' : 'flex max-h-[35%] shrink-0 flex-col border-b border-border'
        }
      >
        <CollapsibleTrigger className="flex shrink-0 items-center gap-2 px-4 py-2 text-muted-foreground">
          <ChevronRight className="size-4" />
          <Txt variant="meta">Prompt blocks</Txt>
        </CollapsibleTrigger>
        <CollapsibleContent fill className="flex min-h-0 flex-col">
          <ScrollArea className="min-h-0 flex-1" mask={false}>
            <SidebarSearchInput
              label="Search prompt blocks"
              placeholder="Search prompts…"
              value={search}
              onValueChange={setSearch}
            />
            <ContextualSidebarSection>
              <nav aria-label="Prompt blocks" className="mt-2">
                <NavigationQueryState isLoading={isLoading} hasError={Boolean(error)} isEmpty={blocks.length === 0}>
                  <Sidebar.NavList>
                    {blocks.map(block => (
                      <Sidebar.NavLink
                        key={block.id}
                        state="default"
                        link={{
                          name: block.name,
                          url: paths.cmsPromptBlockEditLink(block.id),
                          icon: <MessageSquare />,
                        }}
                        isActive={block.id === promptBlockId}
                      />
                    ))}
                  </Sidebar.NavList>
                </NavigationQueryState>
                {data?.hasMore && (
                  <Txt variant="meta" tone="muted" className="block px-3 py-2">
                    Open All prompts to browse the full collection.
                  </Txt>
                )}
                {isFetching && !isLoading && (
                  <Txt role="status" variant="meta" tone="muted" className="px-3">
                    Refreshing prompts…
                  </Txt>
                )}
              </nav>
            </ContextualSidebarSection>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
      {!isCollection && <SidebarSlot />}
    </ContextualSidebarLayout>
  );
}
