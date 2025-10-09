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
  useScorers,
} from '@mastra/playground-ui';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import { useCreateAgent, useModelProviders } from '@/hooks/use-agents';
import { useAgents } from '@/hooks/use-agents';
import { useWorkflows } from '@/hooks/use-workflows';
import { useTools } from '@/hooks/use-all-tools';
import { BasicInfoSection } from './BasicInfoSection';
import { ResourcesSection } from './ResourcesSection';
import { MemoryConfigSection } from './MemoryConfigSection';
import type { AgentFormData, FormErrors } from './types';

const initialFormData: AgentFormData = {
  id: '',
  name: '',
  description: '',
  provider: 'openai',
  modelId: 'gpt-4',
  instructions: '',
  workflowIds: [],
  agentIds: [],
  toolIds: [],
  scorerIds: [],
  memoryConfig: {
    lastMessages: 10,
    semanticRecall: {
      enabled: false,
      topK: 5,
      messageRange: 2,
    },
    workingMemory: {
      enabled: false,
      scope: 'thread',
    },
    threads: {
      generateTitle: false,
    },
  },
};

export default function CreateAgent() {
  const { Link } = useLinkComponent();
  const navigate = useNavigate();
  const { mutateAsync: createAgent, isPending } = useCreateAgent();
  const { data: existingAgents } = useAgents();
  const { data: workflows } = useWorkflows();
  const { tools } = useTools();
  const { data: modelProviders } = useModelProviders();
  const { data: scorers } = useScorers();

  const [formData, setFormData] = useState<AgentFormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  const handleUpdateField = (field: keyof AgentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleUpdateModel = async ({ provider, modelId }: { provider: string; modelId: string }) => {
    setFormData(prev => ({ ...prev, provider, modelId }));
    if (errors.model) {
      setErrors(prev => ({ ...prev, model: '' }));
    }
    return { message: 'Model updated' };
  };

  const handleUpdateMemoryConfig = (updates: Partial<AgentFormData['memoryConfig']>) => {
    setFormData(prev => ({
      ...prev,
      memoryConfig: {
        ...prev.memoryConfig,
        ...updates,
      },
    }));
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

  const handleToggleScorer = (scorerId: string) => {
    setFormData(prev => ({
      ...prev,
      scorerIds: prev.scorerIds.includes(scorerId)
        ? prev.scorerIds.filter(id => id !== scorerId)
        : [...prev.scorerIds, scorerId],
    }));
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};

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

      if (formData.scorerIds.length > 0) {
        payload.scorerIds = formData.scorerIds;
      }

      // Build memory config - only include configured features
      const memoryConfig: any = {};
      let hasMemoryConfig = false;

      if (formData.memoryConfig.lastMessages > 0) {
        memoryConfig.lastMessages = formData.memoryConfig.lastMessages;
        hasMemoryConfig = true;
      }

      if (formData.memoryConfig.semanticRecall) {
        memoryConfig.semanticRecall = {
          enabled: true,
          topK: formData.memoryConfig.semanticRecall.topK,
          messageRange: formData.memoryConfig.semanticRecall.messageRange,
        };
        hasMemoryConfig = true;
      }

      if (formData.memoryConfig.workingMemory.enabled) {
        memoryConfig.workingMemory = {
          enabled: true,
          scope: formData.memoryConfig.workingMemory.scope,
        };
        hasMemoryConfig = true;
      }

      if (formData.memoryConfig.threads.generateTitle) {
        memoryConfig.threads = {
          generateTitle: true,
        };
        hasMemoryConfig = true;
      }

      // Only add memoryConfig if at least one feature is configured
      if (hasMemoryConfig) {
        payload.memoryConfig = memoryConfig;
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
        <div className="h-full flex flex-col px-6 py-6">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <HeaderTitle>Create New Agent</HeaderTitle>
              <Txt className="text-mastra-el-3 mt-1">
                Configure a new agent with custom instructions, tools, and workflows.
              </Txt>
            </div>
            <button
              type="submit"
              disabled={isPending}
              onClick={handleSubmit}
              className="px-5 py-2 text-sm font-semibold text-black bg-[#18fb6f] rounded-lg hover:bg-[#18fb6f]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isPending ? 'Creating...' : 'Create Agent'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5 min-h-0">
            {/* Three Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">
              {/* Left Column - Basic Info */}
              <div className="bg-mastra-bg-3 rounded-lg border border-mastra-border-1 p-5 flex flex-col min-h-0">
                <BasicInfoSection
                  formData={formData}
                  errors={errors}
                  modelProviders={modelProviders || []}
                  onUpdateField={handleUpdateField}
                  onUpdateModel={handleUpdateModel}
                />
              </div>

              {/* Middle Column - Resources */}
              <div className="bg-mastra-bg-3 rounded-lg border border-mastra-border-1 p-5 flex flex-col min-h-0">
                <ResourcesSection
                  formData={formData}
                  workflows={workflows}
                  tools={tools}
                  existingAgents={existingAgents}
                  scorers={scorers}
                  onToggleWorkflow={handleToggleWorkflow}
                  onToggleTool={handleToggleTool}
                  onToggleAgent={handleToggleAgent}
                  onToggleScorer={handleToggleScorer}
                />
              </div>

              {/* Right Column - Memory */}
              <div className="bg-mastra-bg-3 rounded-lg border border-mastra-border-1 p-5 flex flex-col min-h-0">
                <MemoryConfigSection formData={formData} onUpdateMemoryConfig={handleUpdateMemoryConfig} />
              </div>
            </div>

            {/* Error Message */}
            {errors.submit && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">{errors.submit}</p>
              </div>
            )}
          </form>
        </div>
      </MainContentContent>
    </MainContentLayout>
  );
}
