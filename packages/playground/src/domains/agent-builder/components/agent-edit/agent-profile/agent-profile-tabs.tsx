import type { StoredSkillResponse } from '@mastra/client-js';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useBuilderAgentFeatures } from '../../../hooks/use-builder-agent-features';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import type { AgentTool } from '../../../types/agent-tool';
import { Browser } from './browser';
import { Instructions } from './instructions';
import { Integrations } from './integrations';
import { Models } from './models';
import { Skills } from './skills';
import { Tools } from './tools';
import { useChannelPlatforms } from '@/domains/agents/hooks/use-channels';
import { useBuilderModelPolicy } from '@/domains/builder';
import { ToolProvidersSection } from '@/domains/tool-providers/components/tool-providers-section';

// Builder is single-author surface: connections are private to the author.
// `shared` and `caller-supplied` are out — shared belongs to editor/CMS multi-user
// flows, caller-supplied is editor-only (host app resolves end-users at runtime).
const BUILDER_SCOPE = 'per-author' as const;

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
  const form = useFormContext<AgentBuilderEditFormValues>();

  const modelTabEnabled = features.model || policy.active;
  const toolsTabEnabled = (features.tools || features.agents || features.workflows) && availableAgentTools.length > 0;
  const skillsTabEnabled = features.skills && availableSkills.length > 0;
  const browserTabEnabled = features.browser;
  const integrationsTabEnabled = channelPlatforms.some(platform => platform.id === 'slack' && platform.isConfigured);
  const connectionsTabEnabled = !!form;

  const tabContentClassName = 'h-full min-h-0 pb-6 pt-6';
  const isEditable = !disabled;

  const defaultTab = modelTabEnabled ? 'model' : toolsTabEnabled ? 'tools' : 'instructions';
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  return (
    <div className="h-full min-h-0 overflow-hidden" data-testid="agent-profile-tabs">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        defaultTab={defaultTab}
        className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden"
      >
        <TabList variant="line" sticky className="!bg-surface3 px-6">
          {modelTabEnabled && <Tab value="model">Model</Tab>}
          {toolsTabEnabled && <Tab value="tools">Tools</Tab>}
          {connectionsTabEnabled && <Tab value="connections">Connections</Tab>}
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
              <Tools
                availableAgentTools={availableAgentTools}
                editable={isEditable}
                onOpenConnections={connectionsTabEnabled ? () => setActiveTab('connections') : undefined}
              />
            </TabContent>
          )}

          {connectionsTabEnabled && (
            <TabContent value="connections" className={tabContentClassName}>
              <div className="h-full min-h-0 overflow-y-auto p-4">
                <ToolProvidersSection form={form} readOnly={!isEditable} scope={BUILDER_SCOPE} />
              </div>
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
