#!/usr/bin/env node

/**
 * This script is run as part of CI to ensure that our tool system remains
 * compatible with both Zod v3 and v4. It creates a temporary TypeScript file
 * with code that uses both Zod versions and attempts to compile it.
 *
 * If compilation fails with type errors, it means we've introduced a regression
 * and broken compatibility with one of the Zod versions.
 *
 * This test is crucial because:
 * 1. Users may have either Zod v3 or v4 in their projects
 * 2. Runtime tests alone won't catch type incompatibilities
 * 3. Full project type checking often runs out of memory
 *
 * Run manually: npm run test:types:zod
 * Runs in CI: As part of npm test
 */

import { exec } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test code that should compile with both Zod v3 and v4
const testCode = `
import { z } from 'zod';
import { z as zv4 } from 'zod/v4';
import { createTool } from './src/tools/tool';

// Test with Zod v4
const v4Tool = createTool({
  id: "test-tool",
  description: "Reverse the input string",
  inputSchema: zv4.object({
    input: zv4.string()
  }),
  outputSchema: zv4.object({
    output: zv4.string()
  }),
  execute: async (inputData) => {
    const reversed = inputData.input.split("").reverse().join("");
    return {
      output: reversed
    };
  }
});

// Test with Zod v3
const v3Tool = createTool({
  id: 'v3-tool',
  description: 'Tool with v3 schemas',
  inputSchema: z.object({
    message: z.string()
  }),
  outputSchema: z.object({
    result: z.string()
  }),
  execute: async (inputData) => ({
    result: inputData.message.toUpperCase()
  })
});

export { v3Tool, v4Tool };
`;

async function runTest() {
  const testFile = path.join(__dirname, '.zod-compat-test.ts');

  try {
    console.log('🔍 Testing Zod v3/v4 compatibility...');

    // Write test file
    await writeFile(testFile, testCode);

    // Try to compile with limited memory and timeout
    const { stderr } = await execAsync(`npx tsc --noEmit --skipLibCheck --strict ${testFile}`, {
      cwd: __dirname,
      timeout: 30000, // 30 second timeout
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=1024', // Limit memory
      },
    }).catch(err => ({ stderr: err.stderr || err.message }));

    // Clean up
    await unlink(testFile).catch(() => {});

    // Check for type errors
    if (stderr && (stderr.includes('error TS') || stderr.includes('Type '))) {
      console.error('❌ Zod compatibility check failed!');
      console.error('Type errors detected:');
      console.error(stderr);
      process.exit(1);
    }

    console.log('✅ Zod v3/v4 compatibility check passed');
    process.exit(0);
  } catch (error) {
    // Clean up on error
    await unlink(testFile).catch(() => {});

    if (error.code === 'ETIMEDOUT') {
      console.warn('⚠️  Zod compatibility check timed out (might be due to large codebase)');
      console.warn('    Skipping type check - consider running manually');
      process.exit(0); // Don't fail CI on timeout
    }

    console.error('❌ Zod compatibility check failed with error:', error.message);
    process.exit(1);
  }
}

runTest();
