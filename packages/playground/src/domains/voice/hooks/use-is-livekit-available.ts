import { useMastraPackages } from '@/domains/configuration';

// Fail open: loading, legacy servers, and failed requests all leave calls enabled.
export const useIsLiveKitAvailable = () => {
  const { data } = useMastraPackages();

  return { isLiveKitAvailable: data?.liveKitConnectionRouteEnabled !== false };
};
