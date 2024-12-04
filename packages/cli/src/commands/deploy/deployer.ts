import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { bundle } from "../../utils/bundle.js";
import { execa } from "execa";

export abstract class Deployer {
    token: string
    dotMastraPath: string
    name: string = ''
    constructor({ token }: { token: string }) {
        console.log('Deployer created');
        this.token = token;
        this.dotMastraPath = join(process.cwd(), '.mastra');
    }

    async installCli() {
        console.log('Installing CLI...');
    }

    async install() {
        console.log('Installing dependencies...');
        const i = execa('npm', ['install'], {
            cwd: this.dotMastraPath
        })
        i.stdout.pipe(process.stdout);
        await i

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

    async deployCommand({ scope, siteId }: { scope: string, siteId?: string }) {
        console.log(`Deploy command ${scope}...${siteId || ''}`)
    }

    async deploy({ scope, siteId }: { scope: string, siteId?: string }) {
        await this.installCli();
        this.writePkgJson();
        this.writeFiles();
        await this.install();
        await this.build();
        await this.deployCommand({ scope, siteId });
    }
}