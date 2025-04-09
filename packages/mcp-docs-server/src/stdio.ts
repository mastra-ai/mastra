#!/usr/bin/env node
import { runServer } from './index';

runServer().catch(error => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});
