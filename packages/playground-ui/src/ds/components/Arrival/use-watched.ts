import { createContext, useContext, useState } from 'react';

import { ARRIVING_CLASS } from '@/ds/tokens';

import './arrival.css';

/** Outside any scope nothing is watched arriving, so nothing animates. */
export const SettledContext = createContext<{ readonly current: boolean }>({ current: false });

/** Whether the reader was watching when this element mounted — the one boundary every entrance derives from. */
export function useWatched(): boolean {
  const settled = useContext(SettledContext);
  const [watched] = useState(() => settled.current);

  return watched;
}

/** The entrance class if this element mounted while the reader was watching, nothing otherwise. */
export function useArriving(): string | undefined {
  return useWatched() ? ARRIVING_CLASS : undefined;
}
