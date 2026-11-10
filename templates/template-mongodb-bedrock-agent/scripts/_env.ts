// Side-effect module: load .env BEFORE any module that reads process.env is
// imported. Must be the first import in standalone scripts (mastra dev loads
// .env on its own, so this is only needed for scripts run via tsx/node).
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
