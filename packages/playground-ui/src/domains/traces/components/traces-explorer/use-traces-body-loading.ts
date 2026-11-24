import { useTracesConfig } from './traces-explorer-context';

/** Capabilities or filter field discovery are still loading, so the body shows its skeleton. */
export function useTracesBodyLoading() {
  const { isCapabilitiesLoading, discovery } = useTracesConfig();
  return isCapabilitiesLoading || discovery.isLoading;
}
