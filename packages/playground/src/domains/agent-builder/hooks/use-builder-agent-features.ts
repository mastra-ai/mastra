import { useBuilderSettings } from '@/domains/builder/hooks/use-builder-settings';

export const useBuilderAgentFeatures = () => {
  const { data } = useBuilderSettings();
  const features = data?.features?.agent;

  return {
    tools: features?.tools === true,
    memory: features?.memory === true,
    workflows: features?.workflows === true,
    agents: features?.agents === true,
    avatarUpload: features?.avatarUpload === true,
    skills: features?.skills === true,
    model: features?.model === true,
    stars: features?.stars === true,
    browser: features?.browser === true,
  };
};
