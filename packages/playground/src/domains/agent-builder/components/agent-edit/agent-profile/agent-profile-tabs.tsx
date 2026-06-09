import type { StoredSkillResponse } from '@mastra/client-js';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui';
import type { CSSProperties } from 'react';
import { useAgentColor } from '../../../contexts/agent-color-context';
import { useBuilderAgentFeatures } from '../../../hooks/use-builder-agent-features';
import type { AgentTool } from '../../../types/agent-tool';
import { Browser } from './browser';
import { Instructions } from './instructions';
import { Integrations } from './integrations';
import { Models } from './models';
import { Skills } from './skills';
import { Tools } from './tools';
import { useBuilderModelPolicy } from '@/domains/agent-builder';
import { useChannelPlatforms } from '@/domains/agents/hooks/use-channels';

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
  const features = useBuilderAgentFeatures();
  const policy = useBuilderModelPolicy();
  const { data: channelPlatforms = [] } = useChannelPlatforms();
  const agentColor = useAgentColor();

  const tabListStyle = { '--tab-indicator-color': agentColor.background } as CSSProperties;

  const modelTabEnabled = features.model || policy.active;
  const toolsTabEnabled = (features.tools || features.agents || features.workflows) && availableAgentTools.length > 0;
  const skillsTabEnabled = features.skills && availableSkills.length > 0;
  const browserTabEnabled = features.browser;
  const integrationsTabEnabled = channelPlatforms.some(platform => platform.id === 'slack' && platform.isConfigured);

  const tabContentClassName = 'h-full min-h-0 pb-6 pt-6';
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

        <div className="min-h-0 overflow-y-auto h-full">
          {modelTabEnabled && (
            <TabContent value="model" className={tabContentClassName}>
              <Models editable={isEditable} />
            </TabContent>
          )}

          {toolsTabEnabled && (
            <TabContent value="tools" className={tabContentClassName}>
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
