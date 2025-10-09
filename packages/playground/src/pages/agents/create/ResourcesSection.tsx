import { Checkbox } from '@/components/ui/checkbox';
import type { AgentFormData } from './types';

interface ResourcesSectionProps {
  formData: AgentFormData;
  workflows: Record<string, any> | undefined;
  tools: Record<string, any> | undefined;
  existingAgents: Record<string, any> | undefined;
  scorers: Record<string, any> | undefined;
  onToggleWorkflow: (id: string) => void;
  onToggleTool: (id: string) => void;
  onToggleAgent: (id: string, from: 'CODE' | 'CONFIG') => void;
  onToggleScorer: (id: string) => void;
}

export function ResourcesSection({
  formData,
  workflows,
  tools,
  existingAgents,
  scorers,
  onToggleWorkflow,
  onToggleTool,
  onToggleAgent,
  onToggleScorer,
}: ResourcesSectionProps) {
  const hasResources = workflows || tools || existingAgents || scorers;

  if (!hasResources) return null;

  return (
    <div className="space-y-4 flex flex-col h-full">
      <div>
        <h3 className="text-base font-semibold text-mastra-el-1 mb-0.5">Resources</h3>
        <p className="text-xs text-mastra-el-3">Workflows, tools, agents & scorers</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {hasResources ? (
          <>
            {/* Workflows */}
            {workflows && Object.keys(workflows).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-mastra-el-2 uppercase tracking-wider">Workflows</div>
                <div className="space-y-1.5">
                  {Object.entries(workflows).map(([id, workflow]) => (
                    <label
                      key={id}
                      htmlFor={`workflow-${id}`}
                      className="flex items-center space-x-2.5 p-2 rounded-md hover:bg-mastra-bg-4 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        id={`workflow-${id}`}
                        checked={formData.workflowIds.includes(id)}
                        onCheckedChange={() => onToggleWorkflow(id)}
                      />
                      <span className="text-sm text-mastra-el-3 truncate flex-1">{workflow?.name || id}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Tools */}
            {tools && Object.keys(tools).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-mastra-el-2 uppercase tracking-wider">Tools</div>
                <div className="space-y-1.5">
                  {Object.entries(tools).map(([id, tool]) => (
                    <label
                      key={id}
                      htmlFor={`tool-${id}`}
                      className="flex items-center space-x-2.5 p-2 rounded-md hover:bg-mastra-bg-4 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        id={`tool-${id}`}
                        checked={formData.toolIds.includes(id)}
                        onCheckedChange={() => onToggleTool(id)}
                      />
                      <span className="text-sm text-mastra-el-3 truncate flex-1">{tool?.description || id}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Agents */}
            {existingAgents && Object.keys(existingAgents).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-mastra-el-2 uppercase tracking-wider">Sub-Agents</div>
                <div className="space-y-1.5">
                  {Object.entries(existingAgents).map(([id, agent]) => {
                    const agentData = agent as any;
                    const isSelected = formData.agentIds.some(a => a.agentId === id);

                    return (
                      <label
                        key={id}
                        htmlFor={`agent-${id}`}
                        className="flex items-center space-x-2.5 p-2 rounded-md hover:bg-mastra-bg-4 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          id={`agent-${id}`}
                          checked={isSelected}
                          onCheckedChange={() => onToggleAgent(id, agentData?.from || 'CODE')}
                        />
                        <span className="text-sm text-mastra-el-3 truncate flex-1">{agentData?.name || id}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Scorers */}
            {scorers && Object.keys(scorers).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-mastra-el-2 uppercase tracking-wider">Scorers</div>
                <div className="space-y-1.5">
                  {Object.entries(scorers).map(([id, scorerEntry]) => (
                    <label
                      key={id}
                      htmlFor={`scorer-${id}`}
                      className="flex items-center space-x-2.5 p-2 rounded-md hover:bg-mastra-bg-4 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        id={`scorer-${id}`}
                        checked={formData.scorerIds.includes(id)}
                        onCheckedChange={() => onToggleScorer(id)}
                      />
                      <span className="text-sm text-mastra-el-3 truncate flex-1">
                        {(scorerEntry as any)?.scorer?.name || id}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
