import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GetAgentResponse } from '@mastra/client-js';
import { client } from '@/lib/client';

export const useAgents = () => {
  const [agents, setAgents] = useState<Record<string, GetAgentResponse>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      setIsLoading(true);
      try {
        const res = await client.getAgents();
        setAgents(res);
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
  const [agent, setAgent] = useState<GetAgentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAgent = async () => {
      setIsLoading(true);
      try {
        if (!agentId) {
          setAgent(null);
          setIsLoading(false);
          return;
        }
        const res = await client.getAgent(agentId).details();

        setAgent(res);
      } catch (error) {
        setAgent(null);
        console.error('Error fetching agent', error);
        toast.error('Error fetching agent');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgent();
  }, [agentId]);

  return { agent, isLoading };
};
