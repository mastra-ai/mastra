import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { Redis } from '@upstash/redis';

import path from 'path';

const loggerPath = path.join(process.cwd(), 'mastra-agent-logs');

export function createFileLogger() {
  return (log: {
    message: string;
    statusCode: number;
    destinationPath: string;
  }) => {
    const fullPath = path.join(loggerPath, log.destinationPath);
    if (!existsSync(loggerPath)) {
      mkdirSync(loggerPath, { recursive: true });
      return writeFileSync(
        fullPath,
        JSON.stringify([{ ...log, createdAt: new Date() }], null, 2)
      );
    }
    if (!existsSync(fullPath)) {
      return writeFileSync(
        fullPath,
        JSON.stringify([{ ...log, createdAt: new Date() }], null, 2)
      );
    }
    const logs = JSON.parse(readFileSync(fullPath, 'utf-8'));
    logs.push({ ...log, createdAt: new Date() });
    return writeFileSync(fullPath, JSON.stringify(logs, null, 2));
  };
}

export function createUpstashLogger({
  url,
  token,
}: {
  url: string;
  token: string;
}) {
  const redis = new Redis({
    url,
    token: token,
  });
  return (log: {
    message: string;
    statusCode: number;
    destinationPath: string;
  }) => {
    redis.lpush(log.destinationPath, JSON.stringify(log));
  };
}
