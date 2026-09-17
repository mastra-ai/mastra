import type { ReactNode } from 'react';

export function HookDemo({ children }: { children: ReactNode }) {
  return <div className="text-neutral6 flex w-full max-w-2xl flex-col gap-4">{children}</div>;
}
