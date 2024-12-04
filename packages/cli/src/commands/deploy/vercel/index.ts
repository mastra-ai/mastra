import { execa } from "execa";
import { join } from "path";
import { writeFileSync } from "fs";
import { Deployer } from "../deployer.js";
import getPackageManager from "../../../utils/getPackageManager.js";
import { EXPRESS_SERVER } from "../server.js";

export class VercelDeployer extends Deployer {
    name = 'Vercel'
    async installCli() {
        console.log('Installing Vercel CLI...');
        const p = execa(getPackageManager(), ['install', 'vercel', '-g']);
        p.stdout.pipe(process.stdout);
        await p
    }

    async writePkgJson() {
        writeFileSync(join(this.dotMastraPath, 'package.json'), JSON.stringify({
            "name": "server",
            "version": "1.0.0",
            "description": "",
            "main": "index.mjs",
            "scripts": {
                "start": "node ./index.mjs"
            },
            "author": "",
            "license": "ISC",
            "dependencies": {
                "express": "^4.21.1",
                "@mastra/core": "0.1.27-alpha.18"
            }
        }, null, 2))
    }

    writeFiles() {
        writeFileSync(join(this.dotMastraPath, 'vercel.json'), JSON.stringify({
            "version": 2,
            "builds": [
                {
                    "src": "index.mjs",
                    "use": "@vercel/node",
                    "config": { "includeFiles": ["**"] }
                }
            ],
            "routes": [
                {
                    "src": "/(.*)",
                    "dest": "index.mjs"
                }
            ]
        }, null, 2))

        writeFileSync(join(this.dotMastraPath, 'index.mjs'), EXPRESS_SERVER)
    }

    async deployCommand({ scope }: { scope: string }): Promise<void> {
        // Run the Vercel deploy command
        const p2 = execa('vercel', [
            '--scope',
            scope as string,
            '--cwd',
            join(process.cwd(), '.mastra'),
            'deploy',
            '--token',
            this.token,
            '--yes'
        ]);

        p2.stdout.pipe(process.stdout);
        p2.stderr.pipe(process.stderr);

        console.log('Deployment started on Vercel. You can wait for it to finish or exit this command.')
        await p2;
    }
}