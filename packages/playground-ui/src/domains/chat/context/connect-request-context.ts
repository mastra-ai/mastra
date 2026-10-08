import { createContext } from 'react';
import type { ConnectRequestData } from '../messages/connect-request';

export interface ConnectRequestActions {
  onConnect: (request: ConnectRequestData) => void;
  onDecline: (request: ConnectRequestData) => void;
}

export const ConnectRequestActionsContext = createContext<ConnectRequestActions | undefined>(undefined);
