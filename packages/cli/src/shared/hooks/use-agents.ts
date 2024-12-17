import { Agent } from '@mastra/core';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const useAgents = () => {
  const [agents, setAgents] = useState<Record<string, Agent>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/agents');
        if (!res.ok) {
          const error = await res.json();
          setAgents({});
          console.error('Error fetching agents', error);
          toast.error(error?.error || 'Error fetching agents');
          return;
        }
        const data = await res.json();
        setAgents(data);
      } catch (error) {
        setAgents({});
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
  const [agent, setAgent] = useState<Agent | null>(null);
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
        const agent = await res.json();
        setAgent(agent);
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
