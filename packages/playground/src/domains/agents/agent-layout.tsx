import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';
import { useMatch, useParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { AgentConfigPanel, AgentConfigToggle } from '@/domains/agents/components/agent-config-toggle';
import { AgentDetailHeaderActions } from '@/domains/agents/components/agent-detail-header-actions';
import { AgentViewTabs } from '@/domains/agents/components/agent-view-tabs';
import { useHasObservability } from '@/domains/configuration/hooks/use-has-observability';
import { agentCrumb, navCrumb } from '@/domains/navigation/crumbs';
import { AgentToolDrawerBody } from '@/domains/tools/components/tool-drawer/agent-tool-drawer-body';
import { ToolDrawer } from '@/domains/tools/components/tool-drawer/tool-drawer';
import { MessageTracesContext } from '@/lib/ai-ui/message-traces-context';
import { cn } from '@/lib/utils';

const agentCrumbs = [navCrumb('/agents'), agentCrumb];

export const AgentLayout = ({ children }: { children: React.ReactNode }) => {
  const { agentId } = useParams();
  const chatThreadId = useMatch('/agents/:agentId/threads/:threadId')?.params.threadId;
  const isChat = chatThreadId !== undefined;
  const activeView = useMatch('/agents/:agentId/:view/*')?.params.view;
  const viewHasHeading = activeView === 'overview';
  const [configOpen, setConfigOpen] = useState(false);
  const [advancedView, setAdvancedView] = useState(false);
  const { hasObservability } = useHasObservability();
  const showsMessageTraces = isChat && hasObservability && advancedView;
  const configDocked = isChat && configOpen;

  return (
    <>
      <ToolDrawer>
        <AgentToolDrawerBody agentId={agentId!} />
      </ToolDrawer>
      <PageLayout
        variant="fit"
        breadcrumbs={isChat ? undefined : <PageBreadcrumbs crumbs={agentCrumbs} />}
        actionRow={!isChat && <AgentViewTabs agentId={agentId!} />}
        headerActions={<AgentDetailHeaderActions agentId={agentId!} />}
        primaryActions={
          isChat && (
            <>
              {hasObservability && (
                <label className="flex items-center gap-2">
                  <Txt as="span" variant="caption" tone="muted">
                    Advanced view
                  </Txt>
                  <Switch checked={advancedView} onCheckedChange={setAdvancedView} />
                </label>
              )}
              <AgentConfigToggle open={configOpen} onToggle={() => setConfigOpen(open => !open)} />
            </>
          )
        }
      >
        {!viewHasHeading && <h1 className="sr-only">{agentId}</h1>}
        <div className="@container relative h-full min-h-0 min-w-0">
          <div
            data-testid="agent-chat-canvas"
            className={cn(
              'grid h-full min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] transition-[padding] duration-300 ease-out-custom motion-reduce:transition-none',
              configDocked && '@min-[56rem]:pr-[26.5rem]',
            )}
          >
            <MessageTracesContext value={showsMessageTraces}>{children}</MessageTracesContext>
          </div>
          {isChat && <AgentConfigPanel agentId={agentId!} open={configDocked} onClose={() => setConfigOpen(false)} />}
        </div>
      </PageLayout>
    </>
  );
};
