import { spawn } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
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

    // Create runner file
    const runnerPath = join(dotMastraPath, 'runner.js');
    const runnerCode = `
                    import { mastra } from './mastra.js';
                    import { parse as parseUrl } from 'url';
                    import { createServer, IncomingMessage, ServerResponse } from 'http';


                    // Basic router
                    async function handleRequest(req, res) {
                    // Enable CORS
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

                    // Helper to parse JSON body
                    async function getRequestBody(req) {
                        return new Promise((resolve, reject) => {
                            let body = '';
                            req.on('data', chunk => body += chunk);
                            req.on('end', () => {
                            try {
                                resolve(body ? JSON.parse(body) : {});
                            } catch (e) {
                                reject(new Error('Invalid JSON'));
                            }
                            });
                            req.on('error', reject);
                        });
                    }

                    // Helper to send JSON response
                    function sendJson(res, data, status = 200) {
                    res.writeHead(status, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(data));
                    }

                    // Handle preflight requests
                    if (req.method === 'OPTIONS') {
                        res.writeHead(204);
                        res.end();
                        return;
                    }

                    const url = parseUrl(req.url || '');
                    const path = url.pathname;
                    const method = req.method;

                    try {
                        // Route handling
                        switch (true) {
                        case method === 'GET' && path === '/health':
                            sendJson(res, { 
                            status: 'ok', 
                            timestamp: new Date().toISOString() 
                            });
                            break;

                        case method === 'GET' && path === '/api/status':
                            sendJson(res, {
                            version: '1.0.0',
                            module: m,
                            uptime: process.uptime()
                            });
                            break;

                        case method === 'POST' && path === '/agent/text':
                            const body = await getRequestBody(req);
                            console.log(body)
                            const agent = await mastra.getAgent(body.id);
                            console.log(agent)
                            const text = await agent.text({
                                 messages: [body.text]
                            })
                            sendJson(res, { success: true, data: text });
                            break;

                        default:
                            sendJson(res, { 
                            error: 'Not Found',
                            path,
                            method 
                            }, 404);
                        }
                    } catch (error) {
                        console.error('Error handling request:', error);
                        sendJson(res, { 
                        success: false, 
                        error: error instanceof Error ? error.message : 'Internal Server Error' 
                        }, 500);
                    }
                    }

                     // Create and start server
                    const server = createServer(handleRequest);

                    server.listen(${port}, () => {
                    console.log('\x1b[32m%s\x1b[0m', \`🚀 Server running at http://localhost:${port}\`);
                    console.log('Available endpoints:');
                    console.log('  - GET  /health');
                    console.log('  - POST /agent/text');
                    });

                    // Handle graceful shutdown
                    process.on('SIGTERM', () => {
                    console.log('\x1b[33m%s\x1b[0m', 'SIGTERM received. Shutting down gracefully...');
                    server.close(() => process.exit(0));
                    });

                    process.on('SIGINT', () => {
                    console.log('\x1b[33m%s\x1b[0m', 'SIGINT received. Shutting down gracefully...');
                    server.close(() => process.exit(0));
                    });
             `;

    writeFileSync(runnerPath, runnerCode);

    const node = spawn('node', [runnerPath], {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: {
            ...process.env,
            NODE_OPTIONS: '--experimental-specifier-resolution=node --enable-source-maps'
        }
    });


    await new Promise((resolve) => node.on('close', resolve));

    return

    // const node = spawn('node', [runnerPath], {
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