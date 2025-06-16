import { DataHooksContextType, DataHooksProvider } from '@mastra/playground-ui';
import { useWorkflow } from './hooks/use-workflows';

const hooksRecord: DataHooksContextType = {
  useWorkflow,
};

export const AppDataHooksProvider = ({ children }: { children: React.ReactNode }) => {
  return <DataHooksProvider hooksRecord={hooksRecord}>{children}</DataHooksProvider>;
};
