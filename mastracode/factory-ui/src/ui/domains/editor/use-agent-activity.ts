import { useMemo } from 'react';

import { useChatTranscript } from '../chat/context/useChatTranscript';

/** Which files the agent currently has a running tool call against. */
export interface AgentActivity {
  /** Normalized paths (as reported by tool args — may be workdir-absolute). */
  paths: string[];
  /** True when `path` (workspace-relative) matches an active tool call. */
  isActiveFile(path: string): boolean;
  /** True when a directory contains a file the agent is working on. */
  isActiveDir(path: string): boolean;
}

const INACTIVE: AgentActivity = {
  paths: [],
  isActiveFile: () => false,
  isActiveDir: () => false,
};

// Tool args across the agent's file tools name the file `path`, `file_path`
// or `filePath` — accept any string-valued one of them.
function pathFromArgs(args: unknown): string | null {
  if (!args || typeof args !== 'object') return null;
  const record = args as Record<string, unknown>;
  for (const key of ['path', 'file_path', 'filePath']) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

function normalize(path: string): string {
  return path.replace(/^\.\//, '');
}

/**
 * Derives agent file activity from the live transcript: any running tool
 * call whose args carry a file path counts as "working on that file". Tool
 * paths may be absolute inside the sandbox while the editor uses
 * workspace-relative paths, so matching is suffix-tolerant.
 */
export function useAgentActiveFiles(): AgentActivity {
  const { transcript, phase } = useChatTranscript();
  const working = phase === 'working';
  const entries = transcript.entries;

  return useMemo(() => {
    if (!working) return INACTIVE;
    const active = new Set<string>();
    // Only the transcript tail can hold running tools.
    for (const entry of entries.slice(-8)) {
      if (entry.kind !== 'message' || !entry.runtimeTools) continue;
      for (const tool of Object.values(entry.runtimeTools)) {
        if (tool.status !== 'running') continue;
        const path = pathFromArgs(tool.args);
        if (path) active.add(normalize(path));
      }
    }
    if (active.size === 0) return INACTIVE;
    const paths = [...active];
    const isActiveFile = (path: string) => {
      const p = normalize(path);
      return paths.some(a => a === p || a.endsWith(`/${p}`) || p.endsWith(`/${a}`));
    };
    const isActiveDir = (path: string) => {
      const p = normalize(path);
      return paths.some(a => a.startsWith(`${p}/`) || a.includes(`/${p}/`));
    };
    return { paths, isActiveFile, isActiveDir };
  }, [entries, working]);
}
