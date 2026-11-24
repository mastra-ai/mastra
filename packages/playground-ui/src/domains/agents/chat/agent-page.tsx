import type { ComponentProps, ComponentType, ReactNode } from 'react';
import { AgentHeaderActions } from './agent-header-actions';
import { AgentPageConfig } from './agent-page-config';
import type { AgentPageConfigProps } from './agent-page-config';
import { AgentPageFrame } from './agent-page-frame';
import { AgentPageTabs } from './agent-page-tabs';
import { Breadcrumb, Crumb } from '@/ds/components/Breadcrumb';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { useLinkComponent } from '@/lib/framework';

export interface AgentPageDock {
  open: boolean;
  toggle: () => void;
  Mount: ComponentType<{ children: ReactNode }>;
}

export interface AgentPageProps {
  agent: { id: string; name: string };
  overviewHref: string;
  switcher?: ReactNode;
  actions?: Omit<ComponentProps<typeof AgentHeaderActions>, 'configToggle'>;
  tabs?: ComponentProps<typeof AgentPageTabs>;
  config?: Pick<AgentPageConfigProps, 'dock' | 'children' | 'shortcut'>;
  children?: ReactNode;
}

/** The agent route composition shared by Studio and its hosts. */
export function AgentPage({ agent, overviewHref, switcher, actions, tabs, config, children }: AgentPageProps) {
  const { Link } = useLinkComponent();
  const page = (configToggle?: ReactNode) => (
    <AgentPageFrame
      agentId={agent.id}
      breadcrumbs={
        <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden" listClassName="min-w-0">
          <Crumb as={Link} href={overviewHref} icon={<AgentIcon />}>
            Agents
          </Crumb>
          <Crumb as="span" isCurrent switcher={switcher}>
            {agent.name}
          </Crumb>
        </Breadcrumb>
      }
      headerActions={<AgentHeaderActions {...actions} configToggle={configToggle} />}
      tabs={tabs && <AgentPageTabs {...tabs} />}
    >
      {children}
    </AgentPageFrame>
  );

  if (!config) return page();
  return (
    <AgentPageConfig dock={config.dock} shortcut={config.shortcut} renderPage={page}>
      {config.children}
    </AgentPageConfig>
  );
}
