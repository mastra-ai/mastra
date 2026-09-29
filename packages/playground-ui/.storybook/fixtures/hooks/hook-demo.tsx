import type { ReactNode } from 'react';

export function HookDemo({ children }: { children: ReactNode }) {
  return <div className="flex w-full max-w-2xl flex-col gap-4 text-foreground">{children}</div>;
}
