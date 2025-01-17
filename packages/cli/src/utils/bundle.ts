import * as esbuild from 'esbuild';
import { type BuildOptions } from 'esbuild';
import { join } from 'path';
import path from 'path';
import { fileURLToPath } from 'url';

import { upsertMastraDir } from '../commands/deploy/utils.js';
import { FileService } from '../services/service.file.js';

import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function bundleServer(entryPoint: string) {
  try {
    // Ensure .mastra directory exists
    upsertMastraDir();

    const outfile = join(process.cwd(), '.mastra', 'server.mjs');
    const cliNodeModules = join(path.dirname(path.dirname(__dirname)), 'node_modules');

    let missingMastraDependency = false;

    const externalIfMissingPlugin = {
      name: 'external-if-missing',
      setup(build: any) {
        build.onResolve({ filter: /^.*$/ }, (args: any) => {
          if (!args.importer.endsWith('.mastra/index.mjs')) return;
          try {
            const resolvedPath = import.meta.resolve(args.path);
            if (!resolvedPath || resolvedPath.includes('_npx/')) {
              missingMastraDependency = true;
              return { path: args.path, external: true };
            }
          } catch (e) {
            missingMastraDependency = true;
            return { path: args.path, external: true };
          }
        });
      },
    };

    const result = await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      target: 'node20',
      sourcemap: true,
      mainFields: ['module', 'main'],
      minify: false, // Set to true if you want minification
      metafile: true, // Generates build metadata
      logLevel: 'error',
      nodePaths: [cliNodeModules],
      conditions: ['import', 'node'],
      banner: {
        js: `
          import { createRequire } from "module";
          import { fileURLToPath } from 'url';
          import path from 'path';
          const require = createRequire(import.meta.url);
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
        `,
      },
      external: [
        // Mark node built-ins as external
        'fs',
        'path',
        'os',
        'crypto',
        'stream',
        'util',
        'events',
        'http',
        'https',
        'net',
        'tls',
        'zlib',
        'child_process',
        'worker_threads',
        'cluster',
        'dns',
        'dgram',
        'readline',
        'repl',
        'tty',
        'url',
        'v8',
        'vm',
        'module',
        'process',

        // Your packages
        '@mastra/core',
        '@mastra/memory',
        '@mastra/engine',
        '@mastra/firecrawl',
        '@mastra/github',
        '@mastra/rag',
        '@mastra/stabilityai',
      ],
      logOverride: {
        'commonjs-variable-in-esm': 'silent',
      },
      plugins: [externalIfMissingPlugin],
    });

    if (missingMastraDependency) {
      console.error(
        `Missing Mastra dependency. Please install the mastra package in your project or globally using npm i -g mastra`,
      );
      process.exit(1);
    }

    // Output build metadata
    await esbuild.analyzeMetafile(result.metafile);

    return result;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Missing required file,')) {
        logger.info(`Cannot find ${entryPoint} file`);
      }
    } else {
      console.error('Server build failed:', error);
    }
    process.exit(1);
  }
}

export async function bundle(
  dirPath: string,
  {
    useBanner = true,
    ...options
  }: { outfile?: string; entryFile?: string; buildName?: string; useBanner?: boolean } = {},
) {
  try {
    // Ensure .mastra directory exists
    upsertMastraDir();

    const fileService = new FileService();
    const entryPoint = fileService.getFirstExistingFile([join(dirPath, `${options?.entryFile || 'index'}.ts`)]);
    const outfile = options?.outfile || join(process.cwd(), '.mastra', 'mastra.mjs');

    const esbuildConfig: BuildOptions = {
      entryPoints: [entryPoint],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      target: 'node20',
      sourcemap: true,
      minify: true,
      metafile: true,
      logLevel: 'error',
      mainFields: ['module', 'main'],
      conditions: ['import', 'node'],
      logOverride: {
        'commonjs-variable-in-esm': 'silent',
      },
      external: [
        // Mark node built-ins as external
        'assert',
        'buffer',
        'child_process',
        'cluster',
        'constants',
        'crypto',
        'dgram',
        'dns',
        'events',
        'fs',
        'http',
        'http2',
        'https',
        'module',
        'net',
        'os',
        'path',
        'process',
        'punycode',
        'querystring',
        'readline',
        'repl',
        'stream',
        'string_decoder',
        'sys',
        'timers',
        'tls',
        'tty',
        'url',
        'util',
        'v8',
        'vm',
        'wasi',
        'worker_threads',
        'zlib',
        'chromium-bidi/lib/cjs/bidiMapper/BidiMapper',
        'chromium-bidi/lib/cjs/cdp/CdpConnection',

        // Your packages
        '@mastra/core',
        '@mastra/memory',
        '@mastra/engine',
        '@mastra/firecrawl',
        '@mastra/github',
        '@mastra/rag',
        '@mastra/stabilityai',
      ],
    };

    if (useBanner) {
      esbuildConfig.banner = {
        js: `
          import { createRequire } from "module";
          import { fileURLToPath, pathToFileURL } from 'url';
          import path from 'path';

          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          const require = createRequire(import.meta.url);
        `,
      };
    }

    const result = await esbuild.build(esbuildConfig);

    // Log build results
    logger.success(`${options?.buildName} Build completed successfully`);

    // Output build metadata
    await esbuild.analyzeMetafile(result.metafile);

    return result;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Missing required file,')) {
        logger.info(`Cannot find ${dirPath} directory`);
      }
    } else {
      console.error('Build failed:', error);
    }
    process.exit(1);
  }
}
