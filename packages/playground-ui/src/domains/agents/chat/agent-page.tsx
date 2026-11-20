import type { ComponentProps, ComponentType, ReactNode } from 'react';
import { AgentCombobox } from '../agent-combobox';
import { AgentHeaderActions } from './agent-header-actions';
import { AgentPageConfig } from './agent-page-config';
import type { AgentPageConfigProps } from './agent-page-config';
import { AgentPageFrame } from './agent-page-frame';
import { AgentPageTabs } from './agent-page-tabs';
import { Breadcrumb, Crumb, crumbSwitcherTriggerProps } from '@/ds/components/Breadcrumb';
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
  actions?: Omit<ComponentProps<typeof AgentHeaderActions>, 'configToggle'>;
  tabs?: ComponentProps<typeof AgentPageTabs>;
  config?: Pick<AgentPageConfigProps, 'dock' | 'children'>;
  children?: ReactNode;
}

/** The agent route composition shared by Studio and its hosts. */
export function AgentPage({ agent, overviewHref, actions, tabs, config, children }: AgentPageProps) {
  const { navigate } = useLinkComponent();
  const page = (configToggle?: ReactNode) => (
    <AgentPageFrame
      agentId={agent.id}
      breadcrumbs={
        <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden" listClassName="min-w-0">
          <Crumb as="button" onClick={() => navigate(overviewHref)} icon={<AgentIcon />}>
            Agents
          </Crumb>
          <Crumb
            as="span"
            isCurrent
            switcher={<AgentCombobox value={agent.id} {...crumbSwitcherTriggerProps} aria-label="Switch agent" />}
          >
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
    <AgentPageConfig dock={config.dock} renderPage={page}>
      {config.children}
    </AgentPageConfig>
  );
}
