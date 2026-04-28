import { useMastraPackages } from './use-mastra-packages';

export const useHasObservability = () => {
  const { data, isLoading } = useMastraPackages();

  const hasObservability = Boolean(
    data?.observabilityEnabled ?? data?.packages?.some(pkg => pkg.name === '@mastra/observability'),
  );

  return { hasObservability, isLoading };
};
