import { useNetwork } from '@/hooks/use-networks';

export function NetworkLogs({ networkId }: { networkId: string }) {
  const { network, isLoading } = useNetwork(networkId);

  if (isLoading || !network) {
    return (
      <div className="p-4">
        <p className="text-sm text-mastra-el-4">Loading network logs...</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-mastra-el-5 mb-3">Log Drains</h3>
      <p className="text-sm text-mastra-el-4 mb-4">Log drains allow you to stream network logs to external services.</p>

      <div className="bg-mastra-bg-2 p-4 rounded-md text-center">
        <p className="text-sm text-mastra-el-4">No log drains configured</p>
      </div>
    </div>
  );
}
