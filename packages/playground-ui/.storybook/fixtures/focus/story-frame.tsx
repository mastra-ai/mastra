import type { ReactNode } from 'react';

export function FocusStoryFrame({ children }: { children: ReactNode }) {
  return (
    <div className="text-ui-smd text-neutral5 mx-auto grid max-w-xl gap-6 p-4">
      <p className="text-ui-sm text-neutral3">
        Click a control, then press Tab or Shift+Tab to compare pointer and keyboard focus. Use arrows within groups and
        Space to toggle selections.
      </p>
      {children}
    </div>
  );
}
