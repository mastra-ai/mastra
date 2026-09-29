import type { ReactNode } from 'react';

import { DatasetSaveContext } from './dataset-save-context-value';
import type { DatasetSaveContextValue } from './dataset-save-context-value';

export function DatasetSaveProvider({ children, ...value }: DatasetSaveContextValue & { children: ReactNode }) {
  return <DatasetSaveContext.Provider value={value}>{children}</DatasetSaveContext.Provider>;
}
