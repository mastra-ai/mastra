#!/usr/bin/env node
import { exit } from 'node:process';
import { runServer } from './server.js';

runServer().catch(error => {
  console.error('Failed to start server:', error);
  exit(1);
});
