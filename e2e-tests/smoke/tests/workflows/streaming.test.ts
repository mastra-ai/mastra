import { describe, it, expect } from 'vitest';
import { streamWorkflow, streamResumeWorkflow } from '../utils.js';

describe('streaming workflows', () => {
  describe('stream execution', () => {
    it('should stream sequential-steps and receive chunks', async () => {
      const { chunks } = await streamWorkflow('sequential-steps', {
        inputData: { name: 'stream-test' },
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('stream suspend/resume', () => {
    it('should stream suspend then stream resume', async () => {
      const { runId, chunks: startChunks } = await streamWorkflow('basic-suspend', {
        inputData: { item: 'stream-suspend-test' },
      });

      expect(startChunks.length).toBeGreaterThan(0);

      const { chunks: resumeChunks } = await streamResumeWorkflow('basic-suspend', runId, {
        step: 'await-approval',
        resumeData: { approved: true },
      });

      expect(resumeChunks.length).toBeGreaterThan(0);
    });
  });
});
