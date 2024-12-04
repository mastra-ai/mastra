import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { bundle } from "../../utils/bundle.js";
import { execa } from "execa";
import getPackageManager from "../../utils/getPackageManager.js";

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
        console.log('Installing...');
    }

    async install() {
        const i = execa(getPackageManager(), ['install'], {
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

    async deployCommand({ scope }: { scope: string }) {
        console.log(`Deploy command ${scope}...`)
    }

    async deploy({ scope }: { scope: string }) {
        await this.installCli();
        this.writePkgJson();
        this.writeFiles();
        await this.install();
        await this.build();
        await this.deployCommand({ scope });
    }
}