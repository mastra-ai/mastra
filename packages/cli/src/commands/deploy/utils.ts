import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

function upsertMastraDir() {
    const dirPath = join(process.cwd(), '.mastra');
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath);
    }
}

export function writeCreds({ name, scope, token }: { name: string, scope: string, token: string }) {
    upsertMastraDir();
    const creds = getCreds(name);
    writeFileSync(join(process.cwd(), `.mastra`, 'creds.json'), JSON.stringify({
        ...(creds || {}),
        [name]: {
            scope,
            token,
        }
    }))
}

export function getCreds(name: string) {
    try {
        return JSON.parse(readFileSync(join(process.cwd(), `.mastra`, 'creds.json'), 'utf-8'))[name];
    } catch (error) {
        return null;
    }
}