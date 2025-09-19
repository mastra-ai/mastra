import os from 'os';

export const LOCAL = process.env.LOCAL === 'true';
export const TEAM_ID: string = process.env.TEAM_ID ?? '';
export const PROJECT_ID: string = process.env.PROJECT_ID ?? '';
export const BUILD_ID: string = process.env.BUILD_ID ?? '';
export const BUILD_URL: string = process.env.BUILD_URL ?? '';
export const LOG_REDIS_URL: string = process.env.LOG_REDIS_URL ?? 'redis://localhost:6379';
export const BUSINESS_JWT_TOKEN: string = process.env.BUSINESS_JWT_TOKEN ?? '';
export const USER_IP_ADDRESS: string = process.env.USER_IP_ADDRESS ?? '';
export const MASTRA_DIRECTORY: string = process.env.MASTRA_DIRECTORY ?? 'src/mastra';
export const PROJECT_ENV_VARS: Record<string, string> = safelyParseJson(process.env.PROJECT_ENV_VARS ?? '{}');

export const PROJECT_ROOT = LOCAL ? os.tmpdir() + '/project' : (process.env.PROJECT_ROOT ?? '/project');

export function safelyParseJson(json: string) {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}
