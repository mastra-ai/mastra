import express from 'express'
import { mkdirSync } from "fs";
import { join } from "path";
import * as esbuild from 'esbuild';


async function bundle() {
    try {
        // Ensure .mastra directory exists
        await mkdirSync('.mastra', { recursive: true });

        const entryPoint = join(process.cwd(), 'src/mastra', 'index.ts');
        const outfile = join(process.cwd(), '.mastra', 'mastra.js');

        const result = await esbuild.build({
            entryPoints: [entryPoint],
            bundle: true,
            platform: 'node',
            format: 'esm',
            outfile,
            target: 'es2020',
            sourcemap: true,
            minify: false, // Set to true if you want minification
            metafile: true, // Generates build metadata
            logLevel: 'info',
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
                'process'
            ],
            banner: {
                js: `
                  import { createRequire } from 'module';
                  const require = createRequire(import.meta.url);
                `,
            },
        });

        // Log build results
        console.log('Build completed successfully');

        // Output build metadata
        const text = await esbuild.analyzeMetafile(result.metafile);
        // console.log(text);

        return result;
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

export async function serve(port: number) {
    const dotMastraPath = join(process.cwd(), '.mastra');

    await bundle();

    const mastra = await import(join(dotMastraPath, 'mastra.js'));

    console.log(mastra);

    const app = express();

    app.post('/agent/:agentId/text', async (req, res) => {

        const agentId = req.params.agentId;

        const agent = mastra.getAgent(agentId);

        const messages = req.body.messages;

        const result = await agent.text({ messages });

        res.json(result);
    })

    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    })

    return
    //     stdio: ['inherit', 'pipe', 'inherit'],
    //     env: {
    //         ...process.env,
    //         NODE_OPTIONS: '--max-old-space-size=4096'
    //     }
    // });

    // let output = '';
    // node.stdout.on('data', (data) => {
    //     output += data.toString();
    // });

    // node.on('close', (code) => {
    //     // Clean up temp directory
    //     // rmSync(dotMastraPath, { recursive: true, force: true });

    //     if (code === 0 && output) {
    //         try {
    //             const result = JSON.parse(output);
    //             if (result.success) {
    //                 console.log('Result:', result.result);
    //             } else {
    //                 console.error('Error:', result.error);
    //                 process.exit(1);
    //             }
    //         } catch (e) {
    //             console.log(output);
    //         }
    //     } else if (code !== 0) {
    //         console.error('Failed to execute method');
    //         process.exit(1);
    //     }
    // });
}