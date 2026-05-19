import type { StoredSkillResponse } from '@mastra/client-js';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui';
import type { ReactNode } from 'react';
import { useBuilderAgentFeatures } from '../../../hooks/use-builder-agent-features';
import type { AgentTool } from '../../../types/agent-tool';
import { Instructions } from './instructions';
import { Models } from './models';
import { Skills } from './skills';
import { Tools } from './tools';
import { useBuilderModelPolicy } from '@/domains/builder';

type TabValue = 'model' | 'instructions' | 'tools' | 'skills';

interface TabEntry {
  value: TabValue;
  label: string;
  enabled: boolean;
  render: () => ReactNode;
}

export interface AgentProfileTabsProps {
  availableAgentTools: AgentTool[];
  availableSkills: StoredSkillResponse[];
  /** Whether the user can mutate the form. */
  editable?: boolean;
  /** Disables interaction across all tabs (e.g. while a stream is running). */
  disabled?: boolean;
  /** Read-only fallback for the instructions prompt. */
  fallbackInstructions?: string;
}

/**
 * Tabbed configuration panel for the agent profile. The tab list and its
 * matching panels are intentionally declared side-by-side here so the
 * tab → panel mapping is greppable in a single file.
 */
export const AgentProfileTabs = ({
  availableAgentTools,
  availableSkills,
  editable = true,
  disabled = false,
  fallbackInstructions,
}: AgentProfileTabsProps) => {
  const features = useBuilderAgentFeatures();
  const policy = useBuilderModelPolicy();

  const modelTabEnabled = features.model || policy.active;
  const toolsTabEnabled = (features.tools || features.agents || features.workflows) && availableAgentTools.length > 0;
  const skillsTabEnabled = features.skills && availableSkills.length > 0;

  const tabs: TabEntry[] = [
    {
      value: 'model',
      label: 'Model',
      enabled: modelTabEnabled,
      render: () => <Models editable={editable && !disabled} />,
    },
    {
      value: 'instructions',
      label: 'Instructions',
      enabled: true,
      render: () => <Instructions editable={editable && !disabled} fallbackPrompt={fallbackInstructions} />,
    },
    {
      value: 'tools',
      label: 'Tools',
      enabled: toolsTabEnabled,
      render: () => <Tools availableAgentTools={availableAgentTools} editable={editable && !disabled} />,
    },
    {
      value: 'skills',
      label: 'Skills',
      enabled: skillsTabEnabled,
      render: () => <Skills availableSkills={availableSkills} editable={editable && !disabled} />,
    },
  ];

  const visibleTabs = tabs.filter(tab => tab.enabled);
  if (visibleTabs.length === 0) return null;

  const defaultTab = visibleTabs[0].value;

  return (
    <div
      className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-xl border border-border1 bg-surface3 overflow-hidden"
      data-testid="agent-profile-tabs"
    >
      <Tabs defaultTab={defaultTab} className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <TabList variant="line" sticky className="px-2">
          {visibleTabs.map(tab => (
            <Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tab>
          ))}
        </TabList>

        <div className="min-h-0 overflow-y-auto">
          {visibleTabs.map(tab => (
            <TabContent key={tab.value} value={tab.value} className="h-full min-h-0">
              {tab.render()}
            </TabContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
};
