import { DataHooksContext, DataHooksContextType } from './data-hooks-context';

interface DataHooksProviderProps {
  children: React.ReactNode;
  hooksRecord: DataHooksContextType;
}

export const DataHooksProvider = ({ children, hooksRecord }: DataHooksProviderProps) => {
  return <DataHooksContext.Provider value={hooksRecord}>{children}</DataHooksContext.Provider>;
};
