import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as p from '@clack/prompts';
import { getDeployer } from '@mastra/deployer';
import pc from 'picocolors';
import { FileService } from '../../services/service.file.js';
import { logger } from '../../utils/logger.js';
import { runBuild } from '../../utils/run-build.js';
import { BuildBundler } from '../build/BuildBundler.js';
import { preflightBuildOutput } from '../deploy-preflight.js';
import type { PreflightIssue } from '../deploy-preflight.js';
import { getDeployEnvFiles, readEnvVars } from '../studio/deploy.js';
import { rules } from './rules/index.js';
import type { LintContext, LintIssue, LintIssueCode } from './rules/types.js';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface MastraPackage {
  name: string;
  version: string;
  isAlpha: boolean;
}

export interface LintOptions {
  dir?: string;
  root?: string;
  tools?: string[];
  preflight?: boolean;
  skipBuild?: boolean;
  envFile?: string;
  strict?: boolean;
  json?: boolean;
  debug?: boolean;
}

export interface LintResult {
  ok: boolean;
  issues: LintIssue[];
  errorCount: number;
  warningCount: number;
  error?: string;
}

function readPackageJson(dir: string): PackageJson {
  const packageJsonPath = join(dir, 'package.json');
  try {
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    return JSON.parse(packageJsonContent);
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Failed to read package.json', { error: error.message });
    }
    throw error;
  }
}

function getMastraPackages(packageJson: PackageJson): MastraPackage[] {
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const mastraPackages = Object.entries(allDependencies).filter(
    ([name]) => name.startsWith('@mastra/') || name === 'mastra',
  );

  return mastraPackages.map(([name, version]) => ({
    name,
    version,
    isAlpha: version.includes('alpha'),
  }));
}

function toLintIssue(issue: PreflightIssue): LintIssue {
  return {
    ...issue,
    code: issue.code as LintIssueCode,
    scope: 'bundle',
  };
}

function createLintResult(issues: LintIssue[], error?: string): LintResult {
  const errorCount = issues.filter(issue => issue.severity === 'error').length;
  const warningCount = issues.filter(issue => issue.severity === 'warning').length;

  return {
    ok: error === undefined && errorCount === 0,
    issues,
    errorCount,
    warningCount,
    ...(error !== undefined ? { error } : {}),
  };
}

export async function lint(options: LintOptions): Promise<LintResult> {
  const rootDir = options.root || process.cwd();
  const mastraDir = options.dir ? resolve(options.dir) : join(rootDir, 'src', 'mastra');
  const outputDirectory = join(rootDir, '.mastra');

  try {
    const defaultToolsPath = join(mastraDir, 'tools');
    const discoveredTools = [defaultToolsPath, ...(options.tools ?? [])];

    const packageJson = readPackageJson(rootDir);
    const mastraPackages = getMastraPackages(packageJson);

    const context: LintContext = {
      rootDir,
      mastraDir,
      outputDirectory,
      discoveredTools,
      packageJson,
      mastraPackages,
    };

    const projectIssues = (await Promise.all(rules.map(rule => rule.run(context)))).flat();

    if (projectIssues.every(issue => issue.severity !== 'error')) {
      const fileService = new FileService();
      const mastraEntryFile = fileService.getFirstExistingFile([
        join(mastraDir, 'index.ts'),
        join(mastraDir, 'index.js'),
      ]);
      const platformDeployer = await getDeployer(mastraEntryFile, outputDirectory);
      if (!platformDeployer) {
        const deployer = new BuildBundler();
        await deployer.lint(mastraEntryFile, outputDirectory, discoveredTools);
      } else {
        await platformDeployer.lint(mastraEntryFile, outputDirectory, discoveredTools);
      }
    }

    const issues = [...projectIssues];

    if (options.preflight) {
      if (!options.skipBuild) {
        await runBuild(rootDir, { debug: options.debug });
      }

      // Only claim the full env picture when there's an explicit --env-file or
      // an ambient .env* file. Without one (e.g. CI), env vars may live on the
      // platform, so env-guarded issues should warn instead of error.
      const hasEnvFile = Boolean(options.envFile) || (await getDeployEnvFiles(rootDir)).length > 0;
      const envVars = hasEnvFile
        ? await readEnvVars(rootDir, {
            envFile: options.envFile,
            autoAccept: options.json ?? false,
          })
        : {};
      const preflightIssues = await preflightBuildOutput(rootDir, envVars, { hasEnvFile });
      issues.push(...preflightIssues.map(toLintIssue));
    }

    return createLintResult(issues);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Lint check failed', { error: message });
    return createLintResult([], message);
  }
}

export function printLintReport(result: LintResult, options: { strict?: boolean } = {}): void {
  if (result.error) {
    p.log.error(result.error);
    return;
  }

  if (result.issues.length === 0) {
    p.log.success('No issues found.');
    return;
  }

  const warningsAreErrors = options.strict && result.warningCount > 0 && result.errorCount === 0;

  for (const issue of result.issues) {
    const prefix =
      issue.severity === 'error' || warningsAreErrors ? pc.red(`[${issue.code}]`) : pc.yellow(`[${issue.code}]`);
    // fix can be a string (one line) or string[] (one arrow line per step,
    // used by preflight-sourced issues so the DB provisioning options don't
    // squash into one wall of text).
    const fixLines = Array.isArray(issue.fix) ? issue.fix : [issue.fix];
    const fixBlock = fixLines.map(line => `  ${pc.dim('→')} ${line}`).join('\n');
    const message = `${prefix} ${issue.message}\n  ${pc.dim('scope:')} ${issue.scope}\n${fixBlock}`;

    if (issue.severity === 'error' || warningsAreErrors) {
      p.log.error(message);
    } else {
      p.log.warn(message);
    }
  }

  if (warningsAreErrors) {
    p.log.error(`Lint failed in --strict mode: ${result.warningCount} warning(s) treated as errors.`);
  }
}

export function emitLintJson(result: LintResult, options: { strict?: boolean } = {}): void {
  const blocked = result.error !== undefined || result.errorCount > 0 || (options.strict && result.warningCount > 0);

  process.stdout.write(
    JSON.stringify(
      {
        ok: !blocked,
        strict: options.strict ?? false,
        errorCount: result.errorCount,
        warningCount: result.warningCount,
        issues: result.issues,
        ...(result.error !== undefined ? { error: result.error } : {}),
      },
      null,
      2,
    ) + '\n',
  );
}
