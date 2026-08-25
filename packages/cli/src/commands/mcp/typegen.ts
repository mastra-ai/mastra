import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import process from 'node:process';
import * as p from '@clack/prompts';
import { execa } from 'execa';
import pc from 'picocolors';

import { createLogger } from '../../utils/logger.js';

import {
  findMastraEntryCandidates,
  resolveMigrateEntryFile,
  resolveMigratePaths,
  toDetectedProjectRoot,
} from '../migrate/migrate-paths';
import { TYPEGEN_RESULT_MARKER, TypegenBundler } from './TypegenBundler';

export interface TypegenResult {
  success: boolean;
  code?: string;
  message?: string;
  warnings?: string[];
  scannedExports?: string[];
}

/**
 * Extracts the last marker-prefixed JSON result line printed by the bundled typegen entry.
 * The generated code itself contains braces and newlines, so a plain JSON scan of stdout
 * (as `mastra migrate` does) is not reliable here — the entry prefixes its single result
 * line with a marker instead.
 */
export function parseTypegenResult(stdout: string): TypegenResult | undefined {
  const lines = stdout.split('\n').filter(line => line.startsWith(TYPEGEN_RESULT_MARKER));
  const last = lines[lines.length - 1];
  if (!last) return undefined;
  try {
    return JSON.parse(last.slice(TYPEGEN_RESULT_MARKER.length));
  } catch {
    return undefined;
  }
}

/**
 * Resolves where the generated file is written. Defaults to `mcp-tools.generated.ts` next to
 * the Mastra entry file; an explicit `--output` is resolved relative to the project root.
 */
export function resolveTypegenOutputPath(args: { rootDir: string; mastraDir: string; output?: string }): string {
  if (args.output) {
    return isAbsolute(args.output) ? args.output : join(args.rootDir, args.output);
  }
  return join(args.mastraDir, 'mcp-tools.generated.ts');
}

export async function mcpTypegen({
  dir,
  root,
  env,
  output,
  client,
  debug,
}: {
  dir?: string;
  root?: string;
  env?: string;
  output?: string;
  client?: string;
  debug: boolean;
}) {
  const logger = createLogger(debug);
  const { rootDir, mastraDir } = resolveMigratePaths({ cwd: process.cwd(), root, dir });
  const { checkedPaths, entryFile } = resolveMigrateEntryFile(mastraDir);
  const dotMastraPath = join(rootDir, '.mastra');

  if (!entryFile) {
    logger.error(pc.red('Error: Could not find Mastra entry file.'));
    logger.info('');
    logger.info('Expected one of the following files:');
    checkedPaths.forEach(path => logger.info(`  - ${path}`));
    logger.info('');
    logger.info('This command requires a Mastra entrypoint (src/mastra/index.ts or index.js).');
    logger.info('If your project is in a custom location (for example in a monorepo), run:');
    logger.info(pc.cyan('  npx mastra mcp typegen --dir <path/to/src/mastra> --root <path/to/project-root>'));

    const candidates = findMastraEntryCandidates(rootDir, 5);
    if (candidates.length > 0) {
      logger.info('');
      logger.info('Detected candidate entrypoints under the selected root:');
      for (const candidate of candidates) {
        const rootBase = toDetectedProjectRoot(candidate);
        const suggestedDir = relative(rootBase, candidate).replace(/[\\/]index\.(ts|js)$/u, '');
        const suggestedRoot = relative(process.cwd(), rootBase) || '.';
        logger.info(`  - ${candidate}`);
        logger.info(pc.dim(`    Example: npx mastra mcp typegen --dir "${suggestedDir}" --root "${suggestedRoot}"`));
      }
    }

    process.exit(1);
  }

  p.intro(pc.cyan('MCP Tool Type Generation'));

  try {
    const bundler = new TypegenBundler({ customEnvFile: env, clientExport: client });
    bundler.__setLogger(logger);

    logger.info('Building project for type generation...');

    await bundler.prepare(dotMastraPath);

    const discoveredTools = bundler.getAllToolPaths(mastraDir, []);
    await bundler.bundle(entryFile, dotMastraPath, {
      toolsPaths: discoveredTools,
      projectRoot: rootDir,
    });

    logger.info('Connecting to MCP servers and discovering tools...');

    const loadedEnv = await bundler.loadEnvVars();

    const typegenProcess = execa(process.execPath, [join(dotMastraPath, 'output', 'index.mjs')], {
      cwd: rootDir,
      env: {
        NODE_ENV: 'production',
        ...Object.fromEntries(loadedEnv),
      },
      stdio: ['inherit', 'pipe', 'pipe'],
      reject: false,
    });

    let stdoutData = '';
    let stderrData = '';

    typegenProcess.stdout?.on('data', (data: Buffer) => {
      stdoutData += data.toString();
    });

    typegenProcess.stderr?.on('data', (data: Buffer) => {
      stderrData += data.toString();
      if (debug) {
        process.stderr.write(data);
      }
    });

    const processResult = await typegenProcess;
    const result = parseTypegenResult(stdoutData);

    if (!result) {
      logger.error(pc.red('✗ Type generation failed.'));
      if (stderrData) logger.error(stderrData);
      if (processResult.exitCode !== 0 && stdoutData) logger.error(stdoutData);
      process.exit(1);
    }

    for (const warning of result.warnings ?? []) {
      logger.warn(pc.yellow(warning));
    }

    if (!result.success || !result.code) {
      logger.error(pc.red('✗ Type generation failed.'));
      if (result.message) logger.error(result.message);
      if (result.scannedExports) {
        logger.info(`Scanned exports: ${result.scannedExports.join(', ') || '(none)'}`);
      }
      process.exit(1);
    }

    const outputPath = resolveTypegenOutputPath({ rootDir, mastraDir, output });
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, result.code);

    logger.info(pc.green('✓ Generated MCP tool types.'));
    logger.info(`Output: ${relative(process.cwd(), outputPath)}`);
  } catch (error: any) {
    logger.error(pc.red(`Error: ${error.message}`));
    if (debug) {
      logger.error(error);
    }
    process.exit(1);
  }
}
