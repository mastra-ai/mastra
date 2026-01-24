import { create } from 'zustand';

interface WebSocketState {
  isConnected: boolean;
  reconnectAttempts: number;
  lastError: string | null;
  setConnected: (connected: boolean) => void;
  setReconnectAttempts: (attempts: number) => void;
  setLastError: (error: string | null) => void;
  reset: () => void;
}

export const useWebSocketStore = create<WebSocketState>(set => ({
  isConnected: false,
  reconnectAttempts: 0,
  lastError: null,
  setConnected: connected => set({ isConnected: connected }),
  setReconnectAttempts: attempts => set({ reconnectAttempts: attempts }),
  setLastError: error => set({ lastError: error }),
  reset: () => set({ isConnected: false, reconnectAttempts: 0, lastError: null }),
}));
