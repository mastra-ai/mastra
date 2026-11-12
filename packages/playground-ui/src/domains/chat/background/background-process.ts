import { isRecord } from '../messages/signal-data';
import { parseToolArgs } from '../tools/badges/workspace-data-parts';
import { WORKSPACE_TOOLS } from '../tools/workspace-tool-constants';

const STARTED_BACKGROUND_PROCESS = /^Started background process \(PID: (.+)\)$/;

const askedForBackground = (input: unknown) =>
  (typeof input === 'string' || isRecord(input)) && parseToolArgs(input).background === true;

/**
 * The PID a background `execute_command` call returned; undefined for any other call or result. A
 * foreground command that happens to print the same line is not one.
 */
export function backgroundProcessPid(toolName: string, input: unknown, output: unknown): string | undefined {
  if (toolName !== WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND || typeof output !== 'string') return undefined;
  if (!askedForBackground(input)) return undefined;
  return STARTED_BACKGROUND_PROCESS.exec(output.trim())?.[1];
}
