import { useHasObservability } from '@/domains/configuration/hooks/use-has-observability';
import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';

export function useRunMetricsAvailability() {
  const observability = useHasObservability();
  const storage = useObservabilityStorageCapabilities();
  return {
    isChecking: observability.isLoading || storage.isLoading,
    showsActivity: observability.hasObservability && storage.supportsMetrics,
  };
}
