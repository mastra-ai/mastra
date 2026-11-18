import type { CommandResult } from '@mastra/core/workspace';

import { ACCESSIBILITY_HELPER_PATH, ACCESSIBILITY_HELPER_SHA256 } from './computer-accessibility.js';
import type { ComputerExecOptions } from './computer.js';
import { CAPABILITY_SCRIPT, PROBE_SCRIPT, UPLOAD_SCRIPT } from './computer.js';

export interface Call {
  command: string;
  args: string[] | undefined;
  opts: ComputerExecOptions;
}

export type Responder = (call: Call) => Partial<CommandResult> | Promise<Partial<CommandResult>>;

export type ReadinessStep = 'capability' | 'hash' | 'upload' | 'probe';

export const ok = (stdout = ''): Partial<CommandResult> => ({ exitCode: 0, stdout, stderr: '' });

export function result(partial: Partial<CommandResult>): CommandResult {
  const exitCode = partial.exitCode ?? 0;
  return { success: exitCode === 0, exitCode, stdout: '', stderr: '', executionTimeMs: 1, ...partial };
}

export function readinessStep(call: Call): ReadinessStep | undefined {
  if (call.command === 'sha256sum') return 'hash';
  if (call.command !== 'bash') return undefined;
  if (call.args?.[1] === CAPABILITY_SCRIPT) return 'capability';
  if (call.args?.[1] === UPLOAD_SCRIPT) return 'upload';
  if (call.args?.[1] === PROBE_SCRIPT) return 'probe';
  return undefined;
}

/**
 * The in-sandbox side of readiness: the image's desktop, its generation and
 * the uploaded helper file. `respond` answers every other exec; `override`
 * replaces a readiness step's reply (e.g. a failing capability probe).
 */
export function fakeDesktop(
  respond: Responder = () => ok(),
  override: Partial<
    Record<ReadinessStep, (call: Call) => Partial<CommandResult> | Promise<Partial<CommandResult>>>
  > = {},
) {
  const calls: Call[] = [];
  const desktop = { generation: '0123456789abcdef', helper: undefined as string | undefined };
  const exec = async (command: string, args: string[] | undefined, opts: ComputerExecOptions) => {
    const call = { command, args, opts };
    calls.push(call);
    const step = readinessStep(call);
    if (step && override[step]) return result(await override[step]!(call));
    switch (step) {
      case 'capability':
        return result(ok());
      case 'hash':
        return desktop.helper === undefined
          ? result({ exitCode: 1, stderr: `sha256sum: ${args![1]}: No such file or directory` })
          : result(ok(`${desktop.helper}  ${args![1]}\n`));
      case 'upload':
        desktop.helper = ACCESSIBILITY_HELPER_SHA256;
        return result(ok());
      case 'probe':
        return result(ok(`{"ok": true, "generation": "${desktop.generation}"}\n`));
      default:
        return result(await respond(call));
    }
  };
  const of = (step: ReadinessStep) => calls.filter(c => readinessStep(c) === step);
  return {
    exec,
    calls,
    desktop,
    work: () => calls.filter(c => readinessStep(c) === undefined),
    steps: () => calls.map(c => readinessStep(c) ?? 'work'),
    /** How many readiness checks started (one capability probe each). */
    checks: () => of('capability').length,
    uploads: () => of('upload'),
    helperPath: ACCESSIBILITY_HELPER_PATH,
  };
}
