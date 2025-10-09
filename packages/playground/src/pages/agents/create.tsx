import {
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  Icon,
  Breadcrumb,
  Crumb,
  useLinkComponent,
  AgentIcon,
  Txt,
  InputField,
  AgentMetadataModelSwitcher,
} from '@mastra/playground-ui';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import { useCreateAgent, useModelProviders } from '@/hooks/use-agents';
import { useAgents } from '@/hooks/use-agents';
import { useWorkflows } from '@/hooks/use-workflows';
import { useTools } from '@/hooks/use-all-tools';
import { Checkbox } from '@/components/ui/checkbox';

function CreateAgent() {
  const { Link } = useLinkComponent();
  const navigate = useNavigate();
  const { mutateAsync: createAgent, isPending } = useCreateAgent();
  const { data: existingAgents } = useAgents();
  const { data: workflows } = useWorkflows();
  const { tools } = useTools();
  const { data: modelProviders } = useModelProviders();

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    provider: 'openai',
    modelId: 'gpt-4',
    instructions: '',
    workflowIds: [] as string[],
    agentIds: [] as Array<{ agentId: string; from: 'CODE' | 'CONFIG' }>,
    toolIds: [] as string[],
    memoryConfig: {
      lastMessages: 10,
      workingMemory: { enabled: false },
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleToggleWorkflow = (workflowId: string) => {
    setFormData(prev => ({
      ...prev,
      workflowIds: prev.workflowIds.includes(workflowId)
        ? prev.workflowIds.filter(id => id !== workflowId)
        : [...prev.workflowIds, workflowId],
    }));
  };

  const handleToggleTool = (toolId: string) => {
    setFormData(prev => ({
      ...prev,
      toolIds: prev.toolIds.includes(toolId) ? prev.toolIds.filter(id => id !== toolId) : [...prev.toolIds, toolId],
    }));
  };

  const handleToggleAgent = (agentId: string, from: 'CODE' | 'CONFIG') => {
    setFormData(prev => {
      const existingIndex = prev.agentIds.findIndex(a => a.agentId === agentId);
      if (existingIndex >= 0) {
        return {
          ...prev,
          agentIds: prev.agentIds.filter(a => a.agentId !== agentId),
        };
      } else {
        return {
          ...prev,
          agentIds: [...prev.agentIds, { agentId, from }],
        };
      }
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.id.trim()) {
      newErrors.id = 'Agent ID is required';
    } else if (!/^[a-zA-Z0-9-_]+$/.test(formData.id)) {
      newErrors.id = 'Agent ID can only contain letters, numbers, hyphens, and underscores';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Agent name is required';
    }

    if (!formData.provider.trim() || !formData.modelId.trim()) {
      newErrors.model = 'Model is required';
    }

    if (!formData.instructions.trim()) {
      newErrors.instructions = 'Instructions are required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const payload: any = {
        id: formData.id,
        name: formData.name,
        model: `${formData.provider}/${formData.modelId}`,
        instructions: formData.instructions,
      };

      if (formData.description.trim()) {
        payload.description = formData.description;
      }

      if (formData.workflowIds.length > 0) {
        payload.workflowIds = formData.workflowIds;
      }

      if (formData.agentIds.length > 0) {
        payload.agentIds = formData.agentIds;
      }

      if (formData.toolIds.length > 0) {
        payload.toolIds = formData.toolIds;
      }

      if (formData.memoryConfig.workingMemory.enabled || formData.memoryConfig.lastMessages > 0) {
        payload.memoryConfig = formData.memoryConfig;
      }

      await createAgent(payload);
      navigate(`/agents/${formData.id}`);
    } catch (error) {
      console.error('Error creating agent:', error);
      setErrors({ submit: 'Failed to create agent. Please try again.' });
    }
  };

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to="/agents">
            <Icon>
              <AgentIcon />
            </Icon>
            Agents
          </Crumb>
          <Crumb as="span" to="">
            Create Agent
          </Crumb>
        </Breadcrumb>
      </Header>

      <MainContentContent>
        <div className="max-w-4xl mx-auto p-6">
          <div className="mb-6">
            <HeaderTitle>Create New Agent</HeaderTitle>
            <Txt className="text-mastra-el-3 mt-2">
              Configure a new agent with custom instructions, tools, and workflows.
            </Txt>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="text-lg font-semibold text-mastra-el-1">Basic Information</div>

              <InputField
                name="id"
                label="Agent ID"
                required
                value={formData.id}
                onChange={e => handleInputChange('id', e.target.value)}
                placeholder="my-agent"
                error={!!errors.id}
                errorMsg={errors.id}
              />

              <InputField
                name="name"
                label="Agent Name"
                required
                value={formData.name}
                onChange={e => handleInputChange('name', e.target.value)}
                placeholder="My Agent"
                error={!!errors.name}
                errorMsg={errors.name}
              />

              <InputField
                name="description"
                label="Description"
                value={formData.description}
                onChange={e => handleInputChange('description', e.target.value)}
                placeholder="A helpful description of what this agent does"
              />

              <div className="space-y-2">
                <label className="text-[0.8125rem] text-icon3 flex justify-between items-center">
                  Model <i className="text-icon2">(required)</i>
                </label>
                <AgentMetadataModelSwitcher
                  defaultProvider={formData.provider}
                  defaultModel={formData.modelId}
                  updateModel={async ({ provider, modelId }: { provider: string; modelId: string }) => {
                    setFormData(prev => ({ ...prev, provider, modelId }));
                    if (errors.model) {
                      setErrors(prev => ({ ...prev, model: '' }));
                    }
                    return { message: 'Model updated' };
                  }}
                  modelProviders={modelProviders || []}
                />
                {errors.model && (
                  <p className="text-[0.75rem] text-red-400 flex items-center gap-[.5rem]">{errors.model}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[0.8125rem] text-icon3 flex justify-between items-center">
                  Instructions <i className="text-icon2">(required)</i>
                </label>
                <textarea
                  name="instructions"
                  value={formData.instructions}
                  onChange={e => handleInputChange('instructions', e.target.value)}
                  placeholder="You are a helpful assistant that..."
                  rows={6}
                  className="flex grow items-center cursor-pointer text-[0.875rem] text-[rgba(255,255,255,0.8)] border border-[rgba(255,255,255,0.15)] leading-none rounded-lg bg-transparent min-h-[2.5rem] px-[0.75rem] py-[0.5rem] w-full focus:outline-none focus:shadow-[inset_0_0_0_1px_#18fb6f] placeholder:text-icon3 placeholder:text-[.8125rem]"
                />
                {errors.instructions && (
                  <p className="text-[0.75rem] text-red-400 flex items-center gap-[.5rem]">{errors.instructions}</p>
                )}
              </div>
            </div>

            {/* Workflows */}
            {workflows && Object.keys(workflows).length > 0 && (
              <div className="space-y-4">
                <div className="text-lg font-semibold text-mastra-el-1">Workflows</div>
                <div className="space-y-2">
                  {Object.entries(workflows).map(([id, workflow]) => (
                    <div key={id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`workflow-${id}`}
                        checked={formData.workflowIds.includes(id)}
                        onCheckedChange={() => handleToggleWorkflow(id)}
                      />
                      <label htmlFor={`workflow-${id}`} className="text-sm cursor-pointer text-mastra-el-3">
                        {workflow.name || id}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tools */}
            {tools && Object.keys(tools).length > 0 && (
              <div className="space-y-4">
                <div className="text-lg font-semibold text-mastra-el-1">Tools</div>
                <div className="space-y-2">
                  {Object.entries(tools).map(([id, tool]) => (
                    <div key={id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tool-${id}`}
                        checked={formData.toolIds.includes(id)}
                        onCheckedChange={() => handleToggleTool(id)}
                      />
                      <label htmlFor={`tool-${id}`} className="text-sm cursor-pointer text-mastra-el-3">
                        {tool.description || id}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-Agents */}
            {existingAgents && Object.keys(existingAgents).length > 0 && (
              <div className="space-y-4">
                <div className="text-lg font-semibold text-mastra-el-1">Sub-Agents</div>
                <div className="space-y-2">
                  {Object.entries(existingAgents).map(([id, agent]) => {
                    const isSelected = formData.agentIds.some(a => a.agentId === id);
                    return (
                      <div key={id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`agent-${id}`}
                          checked={isSelected}
                          onCheckedChange={() => handleToggleAgent(id, 'CODE')}
                        />
                        <label htmlFor={`agent-${id}`} className="text-sm cursor-pointer text-mastra-el-3">
                          {agent.name || id}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Memory Configuration */}
            <div className="space-y-4">
              <div className="text-lg font-semibold text-mastra-el-1">Memory Configuration</div>

              <InputField
                name="lastMessages"
                label="Last Messages to Remember"
                type="number"
                min={0}
                value={formData.memoryConfig.lastMessages.toString()}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    memoryConfig: {
                      ...prev.memoryConfig,
                      lastMessages: parseInt(e.target.value) || 0,
                    },
                  }))
                }
              />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="workingMemory"
                  checked={formData.memoryConfig.workingMemory.enabled}
                  onCheckedChange={checked =>
                    setFormData(prev => ({
                      ...prev,
                      memoryConfig: {
                        ...prev.memoryConfig,
                        workingMemory: { enabled: checked as boolean },
                      },
                    }))
                  }
                />
                <label htmlFor="workingMemory" className="text-sm cursor-pointer text-mastra-el-3">
                  Enable Working Memory
                </label>
              </div>
            </div>

            {/* Error Message */}
            {errors.submit && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-6 border-t border-border1">
              <button
                type="button"
                onClick={() => navigate('/agents')}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-mastra-el-3 bg-transparent border border-border1 rounded-lg hover:bg-mastra-bg-3 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-mastra-bg-6 rounded-lg hover:bg-mastra-bg-7 disabled:opacity-50"
              >
                {isPending ? 'Creating...' : 'Create Agent'}
              </button>
            </div>
          </form>
        </div>
      </MainContentContent>
    </MainContentLayout>
  );
}

export default CreateAgent;
