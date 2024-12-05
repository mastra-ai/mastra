import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export function upsertMastraDir() {
    const dirPath = join(process.cwd(), '.mastra');
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath);
        execSync(`echo ".mastra" >> .gitignore`);
    }
}

export function writeCreds({
    name,
    scope,
    token,
    siteId,
}: {
    siteId?: string;
    name: string;
    scope: string;
    token: string;
}) {
    upsertMastraDir();
    const creds = getCreds(name);
    writeFileSync(
        join(process.cwd(), `.mastra`, 'creds.json'),
        JSON.stringify({
            ...(creds || {}),
            [name]: {
                scope,
                token,
                siteId,
            },
        }),
    );
}

export function getCreds(name: string) {
    try {
        return JSON.parse(readFileSync(join(process.cwd(), `.mastra`, 'creds.json'), 'utf-8'))[name];
    } catch (error) {
        return null;
    }
}
