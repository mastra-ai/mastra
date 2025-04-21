#!/usr/bin/env node
import { execSync } from 'child_process';
execSync('docker compose -f "./docker-compose.yaml" down --volumes', { stdio: 'inherit' });