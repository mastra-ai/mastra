import { createContext, useContext, useState, ReactNode } from 'react';

export type TraceDialogContextValue = {
  selectedTraceId: string | null;
  isOpen: boolean;
  openTrace: (traceId: string) => void;
  closeTrace: () => void;
};

const TraceDialogContext = createContext<TraceDialogContextValue | null>(null);

export type TraceDialogProviderProps = {
  children: ReactNode;
};

export function TraceDialogProvider({ children }: TraceDialogProviderProps) {
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openTrace = (traceId: string) => {
    setSelectedTraceId(traceId);
    setIsOpen(true);
  };

  const closeTrace = () => {
    setIsOpen(false);
    setSelectedTraceId(null);
  };

  return (
    <TraceDialogContext.Provider value={{ selectedTraceId, isOpen, openTrace, closeTrace }}>
      {children}
    </TraceDialogContext.Provider>
  );
}

export function useTraceDialog() {
  const context = useContext(TraceDialogContext);
  if (!context) {
    throw new Error('useTraceDialog must be used within a TraceDialogProvider');
  }
  return context;
}

export function useTraceDialogOptional() {
  return useContext(TraceDialogContext);
}
