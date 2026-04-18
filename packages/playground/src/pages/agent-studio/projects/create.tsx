import { Button, PageHeader, PageLayout, Txt } from '@mastra/playground-ui';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useProjectMutations } from '@/domains/agent-studio/hooks/use-projects';
import { useStudioAgents } from '@/domains/agent-studio/hooks/use-studio-agents';
import { useLinkComponent } from '@/lib/framework';

export function AgentStudioProjectCreate() {
  const navigate = useNavigate();
  const { Link } = useLinkComponent();
  const { createProject } = useProjectMutations();
  const { agents: candidateAgents } = useStudioAgents({ scope: 'all' });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState(
    "You are the project manager. Coordinate the team to complete the user's goal. " +
      'Delegate to the most qualified agent. When the user @mentions an agent, route the request to that agent only.',
  );
  const [provider, setProvider] = useState('openai');
  const [modelName, setModelName] = useState('gpt-4o');
  const [invitedAgentIds, setInvitedAgentIds] = useState<string[]>([]);

  const submitting = createProject.isPending;

  const handleToggleInvite = (agentId: string) => {
    setInvitedAgentIds(prev => (prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      const project = await createProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        instructions: instructions.trim(),
        model: { provider: provider.trim(), name: modelName.trim() },
        invitedAgentIds,
      });
      toast.success('Project created');
      void navigate(`/agent-studio/projects/${project.id}/chat`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create project');
    }
  };

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageHeader>
          <PageHeader.Title>
            <Users /> New project
          </PageHeader.Title>
        </PageHeader>
      </PageLayout.TopArea>

      <form className="p-6 max-w-2xl flex flex-col gap-5" onSubmit={handleSubmit} data-testid="project-create-form">
        <label className="flex flex-col gap-1.5">
          <Txt variant="ui-md">Name</Txt>
          <input
            data-testid="project-name-input"
            className="bg-surface3 border border-border1 rounded-md px-3 py-2 text-sm"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Launch research"
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <Txt variant="ui-md">Description</Txt>
          <input
            data-testid="project-description-input"
            className="bg-surface3 border border-border1 rounded-md px-3 py-2 text-sm"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Short summary of the project goal"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <Txt variant="ui-md">Supervisor instructions</Txt>
          <textarea
            data-testid="project-instructions-input"
            className="bg-surface3 border border-border1 rounded-md px-3 py-2 text-sm min-h-32 font-mono"
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <Txt variant="ui-md">Model provider</Txt>
            <input
              data-testid="project-provider-input"
              className="bg-surface3 border border-border1 rounded-md px-3 py-2 text-sm"
              value={provider}
              onChange={e => setProvider(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <Txt variant="ui-md">Model name</Txt>
            <input
              data-testid="project-model-input"
              className="bg-surface3 border border-border1 rounded-md px-3 py-2 text-sm"
              value={modelName}
              onChange={e => setModelName(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <Txt variant="ui-md">Invite team agents</Txt>
          {candidateAgents.length === 0 ? (
            <Txt variant="ui-sm" className="text-icon3">
              No stored agents available to invite yet.
            </Txt>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-64 overflow-auto pr-1">
              {candidateAgents.map(agent => (
                <label
                  key={agent.id}
                  className="flex items-center gap-2 text-sm bg-surface3 rounded-md px-3 py-2 cursor-pointer hover:border-border2 border border-transparent"
                >
                  <input
                    type="checkbox"
                    checked={invitedAgentIds.includes(agent.id)}
                    onChange={() => handleToggleInvite(agent.id)}
                    data-testid={`project-invite-${agent.id}`}
                  />
                  <span className="truncate">{agent.name || agent.id}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={submitting} data-testid="project-create-submit">
            {submitting ? 'Creating…' : 'Create project'}
          </Button>
          <Button as={Link} href="/agent-studio/projects" variant="ghost" type="button">
            Cancel
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}

export default AgentStudioProjectCreate;
