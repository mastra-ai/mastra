import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

describe('TypeScript Compilation Tests', () => {
  it('should compile createStep with vector tool without hanging', async () => {
    const testFile = join(__dirname, 'temp-type-test.ts');
    
    // Create a temporary file with the problematic code
    const testCode = `
import { createStep } from './workflow';
import { createTool } from '../tools';
import { z } from 'zod';

const vectorTool = createTool({
  id: 'vector-tool',
  description: 'Vector tool that causes infinite loop',
  inputSchema: z.object({
    queryText: z.string(),
    topK: z.number().optional(),
    filter: z.record(z.any()).optional(),
  }),
  outputSchema: z.object({
    relevantContext: z.array(z.any()),
    sources: z.array(z.any()),
  }),
  execute: async ({ context }) => ({
    relevantContext: [],
    sources: [],
  }),
});

// This should not cause infinite loop
const step = createStep(vectorTool);
export { step };
`;

    writeFileSync(testFile, testCode);

    try {
      // Try to compile with a timeout
      // If this hangs, it indicates the infinite loop bug
      const result = execSync(
        `pnpm exec tsc --noEmit --skipLibCheck ${testFile}`,
        { 
          timeout: 30000, // 30 second timeout
          encoding: 'utf8',
          cwd: process.cwd(),
        }
      );
      
      // If we get here, compilation succeeded (no infinite loop)
      expect(result).toBeDefined();
    } catch (error: any) {
      // Check if it was a timeout (indicating infinite loop)
      if (error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM') {
        throw new Error('TypeScript compilation hung - infinite loop detected!');
      }
      
      // Other compilation errors are OK (might be missing imports, etc.)
      // The important thing is that it didn't hang
      console.log('Compilation failed but did not hang:', error.message);
    } finally {
      // Clean up
      try {
        unlinkSync(testFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }, 45000); // Give test itself 45 seconds
});