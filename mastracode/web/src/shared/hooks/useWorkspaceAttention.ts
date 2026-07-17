import { useCallback, useEffect, useRef, useState } from 'react';

import { playDoneSound } from '../../web/ui/domains/settings/services/doneSound';

/**
 * Tracks which workspaces finished an agent run the user hasn't looked at yet.
 *
 * When a workspace's running flag flips true → false its blinking activity
 * dot should turn solid (and the configured completion sound plays) until
 * the user opens that workspace again. Attention also clears on its own when a new run starts in
 * the workspace, so a solid dot never coexists with a blinking one.
 */
export function useWorkspaceAttention(runningByPath: Record<string, boolean>): {
  attentionByPath: Record<string, boolean>;
  clearAttention: (path: string) => void;
} {
  const previousRef = useRef<Record<string, boolean>>({});
  const [needsAttention, setNeedsAttention] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = runningByPath;
    const finished: string[] = [];
    const started: string[] = [];
    for (const [path, running] of Object.entries(runningByPath)) {
      if (running) started.push(path);
      else if (previous[path] === true) finished.push(path);
    }
    if (finished.length === 0 && started.length === 0) return;
    setNeedsAttention(current => {
      const next = new Set(current);
      for (const path of started) next.delete(path);
      for (const path of finished) next.add(path);
      const unchanged = next.size === current.size && [...next].every(path => current.has(path));
      return unchanged ? current : next;
    });
    if (finished.length > 0) playDoneSound();
  }, [runningByPath]);

  const clearAttention = useCallback((path: string) => {
    setNeedsAttention(current => {
      if (!current.has(path)) return current;
      const next = new Set(current);
      next.delete(path);
      return next;
    });
  }, []);

  return {
    attentionByPath: Object.fromEntries([...needsAttention].map(path => [path, true])),
    clearAttention,
  };
}
