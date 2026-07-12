import type { StoredSkillResponse } from '@mastra/client-js';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import type { CSSProperties } from 'react';
import { useAgentColor } from '../../../contexts/agent-color-context';
import { useBuilderPaneGates } from '../../../hooks/use-builder-pane-gates';
import type { AgentTool } from '../../../types/agent-tool';
import { Browser } from './browser';
import { Instructions } from './instructions';
import { Integrations } from './integrations';
import { Models } from './models';
import { Skills } from './skills';
import { Tools } from './tools';
import { useAllProviderTools } from '@/domains/tool-providers/hooks/use-all-provider-tools';

export interface AgentProfileTabsProps {
  agentId: string;
  availableAgentTools: AgentTool[];
  availableSkills: StoredSkillResponse[];
  disabled?: boolean;
  fallbackInstructions?: string;
}

/**
 * Tabbed configuration panel for the agent profile. The tab list and its
 * matching panels are intentionally declared side-by-side here so the
 * tab → panel mapping is greppable in a single file.
 */
export const AgentProfileTabs = ({
  agentId,
  availableAgentTools,
  availableSkills,
  disabled = false,
  fallbackInstructions,
}: AgentProfileTabsProps) => {
  const agentColor = useAgentColor();

  const tabListStyle = { '--tab-indicator-color': agentColor.background } as CSSProperties;

  // Cache-only re-read: the Tools pane issues the same queries, so React Query
  // dedupes the network requests. Treat "still loading" as "tools may exist"
  // so the tab isn't hidden prematurely.
  const { isLoading: isIntegrationToolsLoading } = useAllProviderTools();
  const gates = useBuilderPaneGates({
    hasAgentTools: availableAgentTools.length > 0 || isIntegrationToolsLoading,
    hasSkills: availableSkills.length > 0,
  });

  const modelTabEnabled = gates.model;
  const toolsTabEnabled = gates.tools;
  const skillsTabEnabled = gates.skills;
  const browserTabEnabled = gates.browser;
  const integrationsTabEnabled = gates.integrations;

  const tabContentClassName = 'h-full min-h-0 pb-6 pt-6';
  // The Model/Tools tabs use a two-pane layout whose left filter pane must run
  // the full height of the panel, so they manage their own vertical spacing
  // instead of inheriting the shared vertical padding.
  const twoPaneTabContentClassName = 'h-full min-h-0 !py-0';
  const isEditable = !disabled;

  const defaultTab = modelTabEnabled ? 'model' : toolsTabEnabled ? 'tools' : 'instructions';

  return (
    <div className="h-full min-h-0 overflow-hidden" data-testid="agent-profile-tabs">
      <Tabs defaultTab={defaultTab} className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <TabList variant="line" sticky className="!bg-surface3 px-6" style={tabListStyle}>
          {modelTabEnabled && <Tab value="model">Model</Tab>}
          {toolsTabEnabled && <Tab value="tools">Tools</Tab>}
          <Tab value="instructions">Instructions</Tab>
          {skillsTabEnabled && <Tab value="skills">Skills</Tab>}
          {browserTabEnabled && <Tab value="browser">Browser</Tab>}
          {integrationsTabEnabled && <Tab value="integrations">Integrations</Tab>}
        </TabList>

        <div className="h-full min-h-0 overflow-y-auto">
          {modelTabEnabled && (
            <TabContent value="model" className={twoPaneTabContentClassName}>
              <Models editable={isEditable} />
            </TabContent>
          )}

          {toolsTabEnabled && (
            <TabContent value="tools" className={twoPaneTabContentClassName}>
              <Tools availableAgentTools={availableAgentTools} editable={isEditable} />
            </TabContent>
          )}

          <TabContent value="instructions" className={tabContentClassName}>
            <Instructions editable={isEditable} fallbackPrompt={fallbackInstructions} />
          </TabContent>

          {skillsTabEnabled && (
            <TabContent value="skills" className={tabContentClassName}>
              <Skills availableSkills={availableSkills} editable={isEditable} />
            </TabContent>
          )}

          {browserTabEnabled && (
            <TabContent value="browser" className={tabContentClassName}>
              <Browser editable={isEditable} />
            </TabContent>
          )}

          {integrationsTabEnabled && (
            <TabContent value="integrations" className={tabContentClassName}>
              <Integrations agentId={agentId} editable={isEditable} />
            </TabContent>
          )}
        </div>
      </Tabs>
    </div>
  );
};
