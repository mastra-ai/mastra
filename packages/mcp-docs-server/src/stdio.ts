#!/usr/bin/env node
import { server } from './index.js';

void server.start({
  transportType: 'stdio',
});
