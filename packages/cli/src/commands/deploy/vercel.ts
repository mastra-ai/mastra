import { execa } from "execa";
import * as prompts from '@clack/prompts';
import getPackageManager from "../../utils/getPackageManager.js";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { bundle } from "../../utils/bundle.js";

export async function vercelDeploy() {
    console.log('Installing Vercel CLI...');
    const p = execa(getPackageManager(), ['install', 'vercel', '-g']);
    p.stdout.pipe(process.stdout);
    await p


    const v = await prompts.text({
        message: 'Provide a Vercel authorization token',
    })

    const scope = await prompts.text({
        message: 'Which Vercel scope do you want to deploy to?',
    })


    if (!existsSync(join(process.cwd(), '.mastra'))) {
        mkdirSync(join(process.cwd(), '.mastra'));
    }

    await bundle();

    writeFileSync(join(process.cwd(), '.mastra', 'package.json'), JSON.stringify({
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

    writeFileSync(join(process.cwd(), '.mastra', 'vercel.json'), JSON.stringify({
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

    // Run the Vercel deploy command
    const p2 = execa('vercel', [
        '--scope',
        scope as string,
        '--cwd',
        join(process.cwd(), '.mastra'),
        'deploy',
        '--token',
        v as string,
        '--yes'
    ]);
    p2.stdout.pipe(process.stdout);
    p2.stdin.pipe(process.stdin);
    await p2;
}


// kp4bTFO7ZTUZYXLeMVQrre1W