import { env } from 'node:process';
import env from '@next/env';

const projectDir = process.cwd();
env.loadEnvConfig(projectDir);
