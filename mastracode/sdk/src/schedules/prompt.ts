/**
 * Fire-time prompt assembly for Mastra Code schedules.
 *
 * File-backed schedules only hold a descriptor; each fire runs the script or
 * re-reads the file so the model always sees current output. Failures become
 * the prompt text rather than a skipped fire — a schedule that silently stops
 * delivering is worse than one that reports "the script broke".
 */
import type { ScheduleCreateSpec } from './args.js';

export const SCRIPT_TIMEOUT_MS = 60_000;

export type ScriptResult = { stdout: string; stderr: string; exitCode: number | null };

export type RunScript = (absPath: string, options: { cwd: string; timeoutMs: number }) => Promise<ScriptResult>;

export type AssemblePromptOptions = {
  cwd: string;
  runScript: RunScript;
  readFile: (absPath: string) => Promise<string>;
};

function appendExtra(text: string, extra: string | undefined): string {
  return extra ? `${text}\n\n${extra}` : text;
}

export function formatScriptOutput(displayPath: string, result: ScriptResult): string {
  const body = [result.stdout, result.stderr]
    .map(part => part.trimEnd())
    .filter(Boolean)
    .join('\n');
  return `Output of ${displayPath} (exit ${result.exitCode ?? 'null'}):\n${body || '(no output)'}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function assembleSchedulePrompt(
  spec: Pick<ScheduleCreateSpec, 'prompt' | 'file' | 'extraPrompt'>,
  options: AssemblePromptOptions,
): Promise<string> {
  const { file } = spec;
  if (!file) return spec.prompt ?? '';

  let text: string;
  try {
    if (file.mode === 'exec') {
      const result = await options.runScript(file.path, { cwd: options.cwd, timeoutMs: SCRIPT_TIMEOUT_MS });
      text = formatScriptOutput(file.displayPath, result);
    } else {
      text = (await options.readFile(file.path)).trim();
    }
  } catch (error) {
    text = `Schedule ${file.displayPath} failed: ${errorMessage(error)}`;
  }
  return appendExtra(text, spec.extraPrompt);
}
