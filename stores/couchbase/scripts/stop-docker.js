#!/usr/bin/env node
import { execSync } from 'child_process';
try {
  execSync('docker compose -f "./docker-compose.yaml" down --volumes', { stdio: 'inherit' });
} catch (error) {
  console.error('Failed to stop container', error);
}
