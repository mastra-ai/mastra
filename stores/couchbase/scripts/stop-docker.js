#!/usr/bin/env node
import { execSync } from 'node:child_process';
try {
  execSync('docker compose -f "./docker-compose.yaml" down --volumes', { stdio: 'inherit' });
} catch (error) {
  console.error('Failed to stop container', error);
}
