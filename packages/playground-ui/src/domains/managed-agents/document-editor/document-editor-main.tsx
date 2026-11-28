import type { ReactNode } from 'react';

export interface DocumentEditorMainProps {
  footer?: ReactNode;
  children: ReactNode;
}

export function DocumentEditorMain({ footer, children }: DocumentEditorMainProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-3 px-8 pt-4">
      <div className="flex min-h-0 w-full max-w-170 flex-1 flex-col gap-6 overflow-y-auto">{children}</div>
      {footer ? <div className="w-full max-w-170">{footer}</div> : null}
    </div>
  );
}
