import { useMastraPackages } from '@/domains/configuration';

export const useIsCmsAvailable = () => {
  const { data, isLoading: isLoadingPackages } = useMastraPackages();

  const isCmsAvailable = Boolean(data?.cmsEnabled);

  return { isCmsAvailable, isLoading: isLoadingPackages };
};
