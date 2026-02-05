import { useMastraPackages, usePackageUpdates } from '@/domains/configuration';

export const useIsCmsAvailable = () => {
  const { data, isLoading: isLoadingPackages } = useMastraPackages();

  const isCmsAvailable = Boolean(data?.packages.find(pkg => pkg.name === '@mastra/editor'));

  return { isCmsAvailable, isLoading: isLoadingPackages };
};
