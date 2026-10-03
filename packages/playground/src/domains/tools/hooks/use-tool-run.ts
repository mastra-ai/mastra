import { useState } from 'react';
import type { ToolRun } from '../utils/tool-run';
import { describeRunError } from '../utils/tool-run';

export type ExecuteTool = (data: unknown, requestContext?: Record<string, unknown>) => Promise<unknown>;

/** Runs a tool from the Playground and keeps the last outcome with how long it took. */
export function useToolRun(executeTool: ExecuteTool, requestContext: Record<string, unknown>) {
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<ToolRun>();

  const runTool = async (data: unknown) => {
    setIsRunning(true);
    const startedAt = performance.now();
    try {
      const output = await executeTool(data, requestContext);
      setLastRun({ status: 'success', output, durationMs: performance.now() - startedAt });
    } catch (error) {
      setLastRun({ status: 'error', error: describeRunError(error), durationMs: performance.now() - startedAt });
    } finally {
      setIsRunning(false);
    }
  };

  return { runTool, isRunning, lastRun };
}
