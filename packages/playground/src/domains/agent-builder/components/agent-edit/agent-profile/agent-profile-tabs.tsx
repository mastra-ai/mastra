import type { StoredSkillResponse } from '@mastra/client-js';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui';
import { useBuilderAgentFeatures } from '../../../hooks/use-builder-agent-features';
import type { AgentTool } from '../../../types/agent-tool';
import { Instructions } from './instructions';
import { Models } from './models';
import { Skills } from './skills';
import { Tools } from './tools';
import { useBuilderModelPolicy } from '@/domains/builder';

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

  const tabContentClassName = 'h-full min-h-0';

  const isEditable = editable && !disabled;

  return (
    <div
      className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-xl border border-border1 bg-surface3 overflow-hidden"
      data-testid="agent-profile-tabs"
    >
      <Tabs defaultTab="instructions" className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <TabList variant="line" sticky className="px-2">
          <Tab value="instructions">Instructions</Tab>
          {modelTabEnabled && <Tab value="model">Model</Tab>}
          {toolsTabEnabled && <Tab value="tools">Tools</Tab>}
          {skillsTabEnabled && <Tab value="skills">Skills</Tab>}
        </TabList>

        <div className="min-h-0 overflow-y-auto">
          {modelTabEnabled && (
            <TabContent value="model" className={tabContentClassName}>
              <Models editable={isEditable} />
            </TabContent>
          )}

          <TabContent value="instructions" className={tabContentClassName}>
            <Instructions editable={isEditable} fallbackPrompt={fallbackInstructions} />
          </TabContent>

          {toolsTabEnabled && (
            <TabContent value="tools" className={tabContentClassName}>
              <Tools availableAgentTools={availableAgentTools} editable={isEditable} />
            </TabContent>
          )}

          {skillsTabEnabled && (
            <TabContent value="skills" className={tabContentClassName}>
              <Skills availableSkills={availableSkills} editable={isEditable} />
            </TabContent>
          )}
        </div>
      </Tabs>
    </div>
  );
};
