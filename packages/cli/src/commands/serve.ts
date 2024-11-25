import express from 'express'
import { mkdirSync } from "fs";
import { join } from "path";
import * as esbuild from 'esbuild';
import { getFirstExistingFile } from '../utils.js';


async function bundle() {
    try {
        // Ensure .mastra directory exists
        await mkdirSync('.mastra', { recursive: true });

        const entryPoint = getFirstExistingFile([
            join(process.cwd(), 'src/mastra', 'index.ts'),
            join(process.cwd(), 'mastra', 'index.ts')
        ])
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

    const app = express();

    app.post('/agent/:agentId/text', async (req, res) => {
        const agentId = req.params.agentId;

        const agent = mastra.getAgent(agentId);

        const messages = req.body.messages;

        const result = await agent.text({ messages });

        res.json(result);
    })

    app.post('/agent/:agentId/stream', async (req, res) => {
      const agentId = req.params.agentId;
      const agent = mastra.getAgent(agentId);
      const messages = req.body.messages;

      res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
      });

      await agent.stream({
          messages,
          onStepFinish: (step: string) => {
              res.write(`data: ${JSON.stringify({ step })}\n\n`);
          },
          onFinish: (result: any) => {
              res.write(`data: ${JSON.stringify({ result })}\n\n`);
              res.write(`data: [DONE]\n\n`);
              res.end();
          }
      });
  });

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