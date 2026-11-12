import { WORKSPACE_TOOLS } from '../tools/workspace-tool-constants';

const STARTED_BACKGROUND_PROCESS = /^Started background process \(PID: (.+)\)$/;

/** The PID a background `execute_command` call returned; undefined for any other call or result. */
export function backgroundProcessPid(toolName: string, output: unknown): string | undefined {
  if (toolName !== WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND || typeof output !== 'string') return undefined;
  return STARTED_BACKGROUND_PROCESS.exec(output.trim())?.[1];
}
