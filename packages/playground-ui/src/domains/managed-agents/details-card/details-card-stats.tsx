import type { ReactNode } from 'react';

export function DetailsCardStats({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>;
}
