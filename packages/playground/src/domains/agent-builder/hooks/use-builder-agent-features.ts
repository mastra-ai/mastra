import { useBuilderSettings } from '@/domains/builder/hooks/use-builder-settings';

export const useBuilderAgentFeatures = () => {
  const { data } = useBuilderSettings();
  const features = data?.features?.agent;

  return {
    tools: features?.tools === true,
    memory: features?.memory === true,
    skills: features?.skills === true,
    workflows: features?.workflows === true,
    agents: features?.agents === true,
  };
};
