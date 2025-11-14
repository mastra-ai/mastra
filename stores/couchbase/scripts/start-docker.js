#!/usr/bin/env node
import { execSync } from 'child_process';
try {
  execSync('docker compose -f "./docker-compose.yaml" ps --quiet');
  console.info('Container already running, bringing it down first...');
  execSync('docker compose -f "./docker-compose.yaml" down --volumes', { stdio: 'inherit' });
} catch (error) {
  console.error('No existing container found', error);
}
try {
  execSync('docker compose -f "./docker-compose.yaml" up --wait', { stdio: 'inherit' });
} catch (error) {
  console.error('Failed to start container', error);
}
