import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';

describe('TypeScript Type Inference', () => {
  it('should not cause infinite loop when creating step from vector tool (exact user scenario)', async () => {
    // Create a test file that reproduces the exact user scenario
    const testCode = `
import { createStep } from './workflow';
import { createVectorQueryTool } from '../../../rag/src/tools/vector-query';

// This replicates the user's exact scenario that was reported
const heroUIRagTool = createVectorQueryTool({
  id: "heroui-rag-tool",
  description: "Search and retrieve reference and guides for using HeroUI", 
  indexName: "heroui_docs",
  vectorStoreName: "test_store",
  model: { modelId: "text-embedding-3-small" }, // mock model
  enableFilter: false,
});

// THIS LINE caused the infinite loop in the original bug report
// If this hangs during TypeScript compilation, it reproduces the bug
const recallHeroUIRagTool = createStep(heroUIRagTool);

export { recallHeroUIRagTool };
`;

    const tempFile = join(__dirname, 'temp-type-test.ts');
    writeFileSync(tempFile, testCode);

    try {
      // Run TypeScript compilation with a timeout
      const result = await new Promise<{ code: number; timeout: boolean }>(resolve => {
        const tsc = spawn('npx', ['tsc', '--noEmit', tempFile], {
          cwd: process.cwd(),
        });

        const timeout = setTimeout(() => {
          tsc.kill();
          resolve({ code: -1, timeout: true });
        }, 10000); // 10 second timeout

        tsc.on('close', code => {
          clearTimeout(timeout);
          resolve({ code: code || 0, timeout: false });
        });
      });

      // If TypeScript hangs (timeout), the test should fail
      if (result.timeout) {
        throw new Error('TypeScript compilation timed out - infinite loop detected!');
      }

      // If we get here, TypeScript compiled successfully without hanging
      expect(result.timeout).toBe(false);
      expect(result.code).not.toBe(-1);
    } finally {
      // Clean up temp file
      try {
        unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }, 15000); // 15 second timeout
});

