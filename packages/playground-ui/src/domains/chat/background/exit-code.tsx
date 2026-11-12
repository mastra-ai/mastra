import { MutedMeta } from './muted-meta';
import { ToolCallExitStatus } from '@/ds/components/ai/tool-call';

/** A background process's exit code, shown even when it is 0: its end came long after the call. */
export function ExitCode({ exitCode }: { exitCode: number }) {
  if (exitCode !== 0) return <ToolCallExitStatus exit={{ exitCode }} />;
  return <MutedMeta>exit 0</MutedMeta>;
}
