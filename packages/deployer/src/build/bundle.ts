import { Workflow, Step } from '@mastra/core';
import * as esbuild from 'esbuild';
import { type BuildOptions } from 'esbuild';
import { join } from 'path';
import { z } from 'zod';

import { FileService } from './fs.js';
import { upsertMastraDir } from './utils.js';

const buildWorkflow = new Workflow({
  name: 'Build',
  triggerSchema: z.object({
    buildName: z.string(),
    entry: z.string(),
    outfile: z.string().optional(),
    useBanner: z.boolean().optional(),
    devMode: z.boolean().optional(),
  }),
});

buildWorkflow.__setLogger(null as any);

const ensureDir = new Step({
  id: 'Ensure Directory',
  execute: async () => {
    // Ensure .mastra directory exists
    upsertMastraDir();
  },
});

const bundleStep = new Step({
  id: 'Bundle',
  execute: async ({ context }) => {
    const devMode = context.machineContext?.triggerData.devMode;
    const buildName = context.machineContext?.triggerData.buildName;
    const useBanner = context.machineContext?.triggerData.useBanner;

    const entry = context.machineContext?.triggerData.entry;

    const outfile = context.machineContext?.triggerData.outfile;

    const fileService = new FileService();
    const entryPoint = fileService.getFirstExistingFile([entry]);
    const outfilePath = outfile || join(process.cwd(), '.mastra', 'mastra.mjs');

    console.log('Entry point:', entryPoint, outfilePath);

    const plugins: any[] = [];

    let missingMastraDependency = false;

    const externalIfMissingPlugin = {
      name: 'external-if-missing',
      setup(build: any) {
        build.onResolve(
          { filter: /^.*$/ },
          // @ts-ignore
          (args: any) => {
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
          },
        );
      },
    };

    if (devMode) {
      plugins.push(externalIfMissingPlugin);
    }

    const esbuildConfig: BuildOptions = {
      entryPoints: [entryPoint],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: outfilePath,
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
        '@mastra/rag',
        '@mastra/evals',
        '@mastra/mcp',
        '@mastra/tts',
        '@mastra/firecrawl',
        '@mastra/github',
        '@mastra/stabilityai',
        // '@mastra/deployer',
      ],
      plugins,
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

    if (devMode && missingMastraDependency) {
      console.error(
        `Missing Mastra dependency. Please install the mastra package in your project or globally using npm i -g mastra`,
      );
      process.exit(1);
    }

    // Log build results
    console.log(`${buildName} Build completed successfully`);

    return result;
  },
});

const analyzeStep = new Step({
  id: 'Analyze',
  execute: async ({ context }) => {
    if (context?.machineContext?.stepResults?.Bundle?.status !== 'success') {
      throw new Error('Bundle step failed');
    }
    return await esbuild.analyzeMetafile(context.machineContext?.stepResults.Bundle.payload.metafile);
  },
});

buildWorkflow.step(ensureDir).then(bundleStep).then(analyzeStep).commit();

export async function bundle(
  entry: string,
  {
    useBanner = true,
    buildName = 'Build',
    outfile,
    devMode,
  }: { devMode?: boolean; outfile?: string; entryFile?: string; buildName?: string; useBanner?: boolean } = {},
) {
  const { start } = buildWorkflow.createRun();

  try {
    await start({
      triggerData: {
        buildName,
        entry,
        useBanner,
        outfile,
        devMode,
      },
    });

    // console.log(JSON.stringify(result, null, 2));

    // return result;
  } catch (error) {
    console.error('Failed to build:', error);
    process.exit(1);
  }
}
