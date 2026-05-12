import { resolve } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';

import { analytics, origin } from '../..';
import { runBuild } from '../../utils/run-build.js';
import { preflightBuildOutput, printPreflightIssues } from '../deploy-preflight.js';
import type { PreflightIssue } from '../deploy-preflight.js';
import { readEnvVars } from '../studio/deploy.js';

export interface VerifyArgs {
  dir?: string;
  envFile?: string;
  skipBuild?: boolean;
  strict?: boolean;
  json?: boolean;
  debug?: boolean;
}

/**
 * Validate that the current project is ready to deploy — without uploading
 * anything. Runs the same preflight checks as `mastra studio deploy` and
 * `mastra server deploy`, but stops after reporting issues.
 *
 * Exit codes:
 *   0 — preflight passed (no issues, or warnings only)
 *   1 — preflight blocked by error-severity issue, or any issue in --strict mode
 */
export const verifyProject = async (args: VerifyArgs): Promise<void> => {
  await analytics.trackCommandExecution({
    command: 'mastra verify',
    args: { ...args },
    execution: async () => {
      await runVerify(args);
    },
    origin,
  });
};

async function runVerify(args: VerifyArgs): Promise<void> {
  const projectDir = resolve(process.cwd(), args.dir ?? '.');
  const json = args.json ?? false;

  if (!json) {
    p.intro('mastra verify');
  }

  // Match deploy's env-file resolution. In JSON mode, never prompt — require
  // an explicit --env-file when multiple candidates exist.
  let issues: PreflightIssue[];
  try {
    if (!args.skipBuild) {
      await runBuild(projectDir, { debug: args.debug });
    }

    const envVars = await readEnvVars(projectDir, {
      envFile: args.envFile,
      autoAccept: json,
    });

    issues = await preflightBuildOutput(projectDir, envVars);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (json) {
      emitJson([], { strict: args.strict ?? false, error: message });
    } else {
      p.log.error(message);
      process.exit(1);
    }
    return;
  }

  if (json) {
    emitJson(issues, { strict: args.strict ?? false });
    return;
  }

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  // strict mode: surface warnings as blocking before delegating to the
  // shared printer (which only blocks on errors).
  if (args.strict && warnings.length > 0 && errors.length === 0) {
    for (const issue of issues) {
      p.log.error(`${pc.red(`[${issue.code}]`)} ${issue.message}\n  ${pc.dim('→')} ${issue.fix}`);
    }
    p.log.error(`Verify failed in --strict mode: ${warnings.length} warning(s) treated as errors.`);
    process.exit(1);
  }

  const outcome = await printPreflightIssues(issues, { autoAccept: true });

  if (outcome === 'blocked') {
    p.outro(pc.red('✖ Verify failed'));
    process.exit(1);
  }

  if (issues.length === 0) {
    p.log.success('No issues found.');
    p.outro(pc.green('✓ Verify passed'));
    return;
  }

  p.outro(pc.yellow(`✓ Verify passed with ${warnings.length} warning(s)`));
}

function emitJson(issues: PreflightIssue[], opts: { strict: boolean; error?: string }): void {
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const blocked = opts.error !== undefined || errors.length > 0 || (opts.strict && warnings.length > 0);

  process.stdout.write(
    JSON.stringify(
      {
        ok: !blocked,
        strict: opts.strict,
        errorCount: errors.length,
        warningCount: warnings.length,
        issues,
        ...(opts.error !== undefined ? { error: opts.error } : {}),
      },
      null,
      2,
    ) + '\n',
  );

  if (blocked) process.exit(1);
}
