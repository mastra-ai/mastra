import { noopLogger, Logger, createLogger } from '@mastra/core/logger';
import { Workflow, Step } from '@mastra/core/workflows';
import * as esbuild from 'esbuild';
import { type BuildOptions } from 'esbuild';
import { join } from 'path';
import { z } from 'zod';

import { FileService } from './fs.js';
import { upsertMastraDir } from './utils.js';

const logger = createLogger({
  name: 'Mastra CLI',
  level: 'debug',
});

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

const ensureDir = new Step({
  id: 'Ensure Directory',
  execute: async () => {
    // Ensure .mastra directory exists
    upsertMastraDir({});
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
      logLevel: 'silent',
      minify: true,
      metafile: true,
      mainFields: ['module', 'main'],
      conditions: ['import', 'node'],
      logOverride: {
        'commonjs-variable-in-esm': 'silent',
      },
      external: [
        'execa',
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
        '@mastra/firecrawl',
        '@mastra/github',
        '@mastra/stabilityai',

        // Your deployer packages
        '@mastra/deployer',
        '@mastra/deployer-cloudflare',
        '@mastra/deployer-netlify',
        '@mastra/deployer-vercel',

        // Your speech packages
        '@mastra/speech-elevenlabs',
        '@mastra/speech-openai',
        '@mastra/speech-playai',
        '@mastra/speech-azure',
        '@mastra/speech-deepgram',
        '@mastra/speech-google',
        '@mastra/speech-ibm',
        '@mastra/speech-murf',
        '@mastra/speech-speechify',
        '@mastra/speech-replicate',

        // Your vector store packages
        '@mastra/vector-astra',
        '@mastra/vector-chroma',
        '@mastra/vector-libsql',
        '@mastra/vector-pg',
        '@mastra/vector-pinecone',
        '@mastra/vector-qdrant',
        '@mastra/vector-upstash',
        '@mastra/vector-vectorize',
      ],
      plugins,
    };

    if (useBanner) {
      esbuildConfig.banner = {
        js: `
                import { createRequire } from "node:module";                
                const require = createRequire(import.meta.url || 'file:///');
              `,
      };
    }

    const result = await esbuild.build(esbuildConfig);

    if (devMode && missingMastraDependency) {
      logger.error(
        `Missing Mastra dependency. Please install the mastra package in your project or globally using npm i -g mastra`,
      );
      process.exit(1);
    }

    // Log build results
    logger.info(`[${buildName}]: completed successfully`);

    return result;
  },
});

const analyzeStep = new Step({
  id: 'Analyze',
  execute: async ({ context }) => {
    if (context?.machineContext?.stepResults?.Bundle?.status !== 'success') {
      throw new Error('Bundle step failed');
    }
    const res = await esbuild.analyzeMetafile(context.machineContext?.stepResults.Bundle.payload.metafile);
    return res;
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

  buildWorkflow.__setLogger(noopLogger as unknown as Logger);

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
  } catch (error) {
    logger.error('Failed to build:', { error });
    process.exit(1);
  }
}
