import { join } from 'node:path';
import process from 'node:process';
import type { OutputFormat } from '@mastra/core/harness';
import { FileService } from '@mastra/deployer/build';
import { execa } from 'execa';
import pc from 'picocolors';

import { createLogger } from '../../utils/logger.js';
import { RunBundler } from './RunBundler.js';
import type { RunEntryOptions } from './RunBundler.js';

export interface RunArgs {
  prompt?: string;
  agent: string;
  outputFormat: string;
  jsonSchema?: string;
  strict: boolean;
  dir?: string;
  root?: string;
  env?: string;
  debug: boolean;
}

export function isOutputFormat(value: string): value is OutputFormat {
  return (['text', 'json', 'stream-json'] as readonly string[]).includes(value);
}

/**
 * Read prompt from stdin when piped (non-TTY).
 */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8').trim();
}

export async function run(args: RunArgs) {
  const logger = createLogger(args.debug);
  const rootDir = args.root || process.cwd();
  const mastraDir = args.dir
    ? args.dir.startsWith('/')
      ? args.dir
      : join(rootDir, args.dir)
    : join(rootDir, 'src', 'mastra');
  const dotMastraPath = join(rootDir, '.mastra');

  // Resolve prompt: -p flag takes priority, then stdin pipe
  let prompt = args.prompt;
  if (!prompt) {
    if (!process.stdin.isTTY) {
      prompt = await readStdin();
    }
    if (!prompt) {
      process.stderr.write(
        'Error: No prompt provided. Use -p "your prompt" or pipe via stdin.\n' +
          '  Example: mastra run -p "Hello" --agent myAgent\n' +
          '  Example: echo "Hello" | mastra run --agent myAgent\n',
      );
      process.exit(2);
    }
  }

  if (!isOutputFormat(args.outputFormat)) {
    process.stderr.write(
      `Error: Invalid --output-format "${args.outputFormat}". Must be one of: text, json, stream-json.\n`,
    );
    process.exit(2);
  }
  const outputFormat: OutputFormat = args.outputFormat;

  // Validate flag combinations
  if (args.jsonSchema && outputFormat === 'text') {
    process.stderr.write('Error: --json-schema requires --output-format json or stream-json.\n');
    process.exit(2);
  }

  const entryOptions: RunEntryOptions = {
    prompt,
    agentId: args.agent,
    outputFormat,
    jsonSchema: args.jsonSchema,
    strict: args.strict,
  };

  try {
    const fileService = new FileService();
    const entryFile = fileService.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);

    const bundler = new RunBundler(entryOptions, args.env);
    bundler.__setLogger(logger);

    if (args.outputFormat === 'text') {
      logger.debug('Bundling project...');
    }

    await bundler.prepare(dotMastraPath);

    const discoveredTools = bundler.getAllToolPaths(mastraDir, []);
    await bundler.bundle(entryFile, dotMastraPath, {
      toolsPaths: discoveredTools,
      projectRoot: rootDir,
    });

    const loadedEnv = await bundler.loadEnvVars();

    const childProcess = execa(process.execPath, [join(dotMastraPath, 'output', 'index.mjs')], {
      cwd: rootDir,
      env: {
        NODE_ENV: 'production',
        ...Object.fromEntries(loadedEnv),
      },
      // stdout: pipe to parent for output capture
      // stderr: pipe to parent stderr
      // stdin: not needed (prompt is embedded in the entry script)
      stdio: ['ignore', 'pipe', 'pipe'],
      reject: false,
    });

    // Forward child stdout directly to parent stdout (preserves streaming for text/stream-json)
    childProcess.stdout?.pipe(process.stdout);

    // Forward child stderr to parent stderr
    childProcess.stderr?.pipe(process.stderr);

    // Forward SIGINT to child process
    const sigintHandler = () => {
      childProcess.kill('SIGINT');
    };
    process.on('SIGINT', sigintHandler);

    const result = await childProcess;

    process.removeListener('SIGINT', sigintHandler);

    process.exit(result.exitCode ?? 1);
  } catch (error: any) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
      process.stderr.write(pc.red('Error: Could not find Mastra entry file.\n'));
      process.stderr.write('\nMake sure you have a mastra directory with an index.ts or index.js file.\n');
      process.stderr.write(`Expected location: ${mastraDir}\n\n`);
      process.stderr.write(pc.cyan('  npx mastra run --dir path/to/mastra\n'));
    } else {
      process.stderr.write(pc.red(`Error: ${error.message}\n`));
      if (args.debug) {
        console.error(error);
      }
    }
    process.exit(2);
  }
}
