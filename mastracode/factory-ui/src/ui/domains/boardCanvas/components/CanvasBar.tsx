import { IconMagnifyingGlass } from '@mastra/playground-ui/icons/central/IconMagnifyingGlass';
import type { ReactNode } from 'react';

/** Where someone pastes an issue or pull request to see where it would land. */
export function TestInput({ onTest, defaultValue }: { onTest: (subject: string) => void; defaultValue?: string }) {
  return (
    <form
      role="search"
      className="flex min-w-0 flex-1 items-center gap-2.5"
      onSubmit={event => {
        event.preventDefault();
        const subject = new FormData(event.currentTarget).get('subject');
        if (typeof subject === 'string' && subject.trim()) onTest(subject.trim());
      }}
    >
      <IconMagnifyingGlass className="text-muted-foreground size-icon-sm shrink-0" aria-hidden />
      <input
        name="subject"
        defaultValue={defaultValue}
        aria-label="Test an issue or pull request"
        placeholder="Paste an issue or pull request URL"
        className="text-body-sm text-foreground placeholder:text-placeholder min-w-0 flex-1 bg-transparent outline-none"
      />
    </form>
  );
}

/** The floating toolbar at the bottom of the canvas. */
export function CanvasToolbar({ children }: { children: ReactNode }) {
  return (
    <div
      role="toolbar"
      aria-label="Canvas"
      className="bg-card shadow-overlay flex h-12 w-full max-w-130 items-center gap-2.5 rounded-3xl pr-2 pl-4"
    >
      {children}
    </div>
  );
}
