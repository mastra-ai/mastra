#! /usr/bin/env node
import * as module from 'node:module';

// Lets Node reuse the compiled CLI code across runs (NODE_DISABLE_COMPILE_CACHE turns it off). It only covers modules
// loaded after this call, so the CLI is imported dynamically: a static import would be loaded first.
module.enableCompileCache?.();

await import('./index');
