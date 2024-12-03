import { existsSync, mkdirSync } from "fs";
import * as esbuild from 'esbuild';
import { getFirstExistingFile } from "../utils.js";
import { join } from "path";

export async function bundle() {
    try {
        // Ensure .mastra directory exists
        if (!existsSync('.mastra')) {
            mkdirSync('.mastra', { recursive: true });
        }

        const entryPoint = getFirstExistingFile([
            join(process.cwd(), 'src/mastra', 'index.ts'),
            join(process.cwd(), 'mastra', 'index.ts'),
        ]);
        const outfile = join(process.cwd(), '.mastra', 'mastra.mjs');

        const result = await esbuild.build({
            entryPoints: [entryPoint],
            bundle: true,
            platform: 'node',
            format: 'esm',
            outfile,
            target: 'node20',
            sourcemap: true,
            minify: false, // Set to true if you want minification
            metafile: true, // Generates build metadata
            logLevel: 'error',
            logOverride: {
                'commonjs-variable-in-esm': 'silent',
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
                '@mastra/core',
            ],
        });

        // Log build results
        console.log('Build completed successfully');

        // Output build metadata
        await esbuild.analyzeMetafile(result.metafile);

        return result;
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}