#! /usr/bin/env node
import * as module from 'node:module';
import { applyDevRolldownEnvDefaults } from './commands/dev/rolldown-env';

// Lets Node reuse the compiled CLI code across runs (NODE_DISABLE_COMPILE_CACHE turns it off). It only covers modules
// loaded after this call, so the CLI is imported dynamically: a static import would be loaded first.
module.enableCompileCache?.();

// Before the CLI import below, which loads Rolldown.
applyDevRolldownEnvDefaults(process.argv.slice(2));

await import('./index');
