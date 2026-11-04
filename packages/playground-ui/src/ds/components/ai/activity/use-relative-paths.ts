import { createContext, useContext } from 'react';

export const WorkingDirectoryContext = createContext<string | undefined>(undefined);

function relativeTo(directory: string | undefined, text: string): string {
  const root = directory?.replace(/\/+$/, '');
  if (!root) return text;
  const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(?<![^\\s'"=(])${escaped}(?:/(?=[^\\s/])|(?![\\w.-]))`, 'g'), match =>
    match.endsWith('/') ? '' : '.',
  );
}

/** Rewrites text the way `ActivityDetail` shows it, for names that must say the same thing. */
export function useRelativePaths(): (text: string) => string {
  const directory = useContext(WorkingDirectoryContext);
  return text => relativeTo(directory, text);
}
