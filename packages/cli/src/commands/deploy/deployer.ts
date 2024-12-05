import { execa } from 'execa';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { bundle } from '../../utils/bundle.js';

export abstract class Deployer {
    token: string;
    dotMastraPath: string;
    name: string = '';

    constructor({ token }: { token: string }) {
        console.log('Deployer created');
        this.token = token;
        this.dotMastraPath = join(process.cwd(), '.mastra');
    }

    async installCli() {
        console.log('Installing...');
    }

    async install() {
        console.log('Installing dependencies...');
        const i = execa('npm', ['install'], {
            cwd: this.dotMastraPath,
        });
        i.stdout.pipe(process.stdout);
        await i;
    }

    protected getEnvFiles(): string[] {
        const envFiles = ['.env', '.env.development', '.env.local']
            .map(file => join(process.cwd(), file))
            .filter(file => existsSync(file));
        return envFiles;
    }

    getEnvVars() {
        // Get all env vars
        const envFiles = this.getEnvFiles();
        const envVars: Record<string, string> = {};

        for (const file of envFiles) {
            const vars = this.parseEnvFile(file);
            for (const envVar of vars) {
                const [key, value] = envVar.split('=');
                if (key && value) {
                    envVars[key] = value;
                }
            }
        }

        return envVars
    }

    protected parseEnvFile(filePath: string): string[] {
        const content = readFileSync(filePath, 'utf-8');
        return content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .filter(line => line.includes('=')); // Only include valid KEY=value pairs
    }

    async build() {
        if (!existsSync(this.dotMastraPath)) {
            mkdirSync(this.dotMastraPath);
        }

        await bundle();
    }

    writePkgJson() {
        console.log('Writing package.json...');
    }

    writeFiles() {
        console.log('Writing files...');
    }

    async deployCommand({ scope, siteId }: { scope: string; siteId?: string }) {
        console.log(`Deploy command ${scope}...${siteId || ''}`);
    }

    async deploy({ scope, siteId }: { scope: string; siteId?: string }) {
        console.log('Deploying...', scope, siteId);
        await this.installCli();
        this.writePkgJson();
        this.writeFiles();
        await this.install();
        await this.build();
        await this.deployCommand({ scope, siteId });
    }
}
