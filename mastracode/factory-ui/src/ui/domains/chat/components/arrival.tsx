import { cn } from '@mastra/playground-ui/utils/cn';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const TranscriptSettledContext = createContext(false);

/**
 * Separates the transcript the reader was handed from what lands afterwards.
 * History paints at once and must not replay; everything mounting later is the
 * run happening in front of them, and fades in.
 */
export function TranscriptArrival({ children }: { children: ReactNode }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => setSettled(true), []);

  return <TranscriptSettledContext value={settled}>{children}</TranscriptSettledContext>;
}

export function useArrivedLive(): boolean {
  const settled = useContext(TranscriptSettledContext);
  const [arrivedLive] = useState(() => settled);

  return arrivedLive;
}

export function Arriving({ children, className }: { children: ReactNode; className?: string }) {
  const arrivedLive = useArrivedLive();

  return <div className={cn(arrivedLive && 'mastra-arriving', className)}>{children}</div>;
}
