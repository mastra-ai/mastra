import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Agent, AgentWithTools } from '../types';

export const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/agents');
        if (!res.ok) {
          const error = await res.json();
          setAgents([]);
          console.error('Error fetching agents', error);
          toast.error(error?.error || 'Error fetching agents');
          return;
        }
        const data = await res.json();
        setAgents(data);
      } catch (error) {
        setAgents([]);
        console.error('Error fetching agents', error);
        toast.error('Error fetching agents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgents();
  }, []);

  return { agents, isLoading };
};

export const useAgent = (agentId: string) => {
  const [agent, setAgent] = useState<AgentWithTools | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAgent = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/agents/${agentId}`);
        if (!res.ok) {
          const error = await res.json();
          setAgent(null);
          console.error('Error fetching agent', error);
          toast.error(error?.error || 'Error fetching agent');
          return;
        }
        const { name, instructions, model, tools } = await res.json();
        setAgent({
          name,
          instructions,
          modelProvider: model.provider,
          modelName: model.name,
          tools: Object.keys(tools),
        });
      } catch (error) {
        setAgent(null);
        console.error('Error fetching agent', error);
        toast.error('Error fetching agent');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgent();
  }, []);

  return { agent, isLoading };
};
