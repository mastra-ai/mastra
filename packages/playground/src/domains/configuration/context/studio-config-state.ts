import { createContext, useContext } from 'react';

import type { ConnectionFailure } from '../hooks/use-mastra-instance-status';
import type { StudioConfig } from '../types';

export type StudioConfigContextType = StudioConfig & {
  isLoading: boolean;
  setConfig: (partialNewConfig: Partial<StudioConfig>) => void;
};

export const StudioConfigContext = createContext<StudioConfigContextType>({
  baseUrl: '',
  headers: {},
  apiPrefix: undefined,
  isLoading: false,
  setConfig: () => {},
});

export const useStudioConfig = () => {
  return useContext(StudioConfigContext);
};

export type StudioConnection =
  | { status: 'connecting' }
  | { status: 'connected' }
  | { status: 'waiting'; httpStatus?: number }
  | { status: 'failed'; failure: ConnectionFailure };

export type StudioConnectionContextType = {
  connection: StudioConnection;
  /** The user is changing the connection: Studio stops checking the current one. */
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
  /** Back to the connection the server gave Studio. Absent while that is the one in use. */
  resetConfig?: () => void;
};

export const StudioConnectionContext = createContext<StudioConnectionContextType>({
  connection: { status: 'connecting' },
  isEditing: false,
  setIsEditing: () => {},
});

export const useStudioConnection = () => {
  return useContext(StudioConnectionContext);
};
