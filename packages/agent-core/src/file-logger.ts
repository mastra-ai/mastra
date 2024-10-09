import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const loggerPath = path.join(process.cwd(), 'mastra-agent-logs')

export function createFileLogger({ destinationPath }: { destinationPath: string }) {
    const fullPath = path.join(loggerPath, destinationPath);
    return (log: { message: string }) => {
        if (!existsSync(loggerPath)) {
            mkdirSync(loggerPath, { recursive: true });
            return writeFileSync(fullPath, JSON.stringify([{ ...log, created_at: new Date() }], null, 2));
        }
        const logs = JSON.parse(readFileSync(fullPath, 'utf-8'));
        logs.push({ ...log, created_at: new Date() });
        return writeFileSync(fullPath, JSON.stringify(logs, null, 2));
    }
}