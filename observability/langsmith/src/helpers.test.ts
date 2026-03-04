/**
 * LangSmith Helpers Tests
 */

import { describe, expect, it } from 'vitest';
import { withLangsmithMetadata } from './helpers';

describe('LangSmith Helpers', () => {
  describe('withLangsmithMetadata', () => {
    it('should add all metadata fields', () => {
      const updater = withLangsmithMetadata({
        projectName: 'my-project',
        sessionId: 'session-123',
        sessionName: 'My Session',
      });
      const result = updater({});

      expect(result.metadata).toEqual({
        langsmith: {
          projectName: 'my-project',
          sessionId: 'session-123',
          sessionName: 'My Session',
        },
      });
    });

    it('should add partial metadata', () => {
      const updater = withLangsmithMetadata({
        sessionId: 'session-only',
      });
      const result = updater({});

      expect(result.metadata).toEqual({
        langsmith: {
          sessionId: 'session-only',
        },
      });
    });

    it('should preserve existing options', () => {
      const updater = withLangsmithMetadata({
        projectName: 'my-project',
      });
      const result = updater({
        spanName: 'my-span',
        metadata: {
          existingKey: 'existingValue',
        },
      });

      expect(result.spanName).toBe('my-span');
      expect(result.metadata).toEqual({
        existingKey: 'existingValue',
        langsmith: {
          projectName: 'my-project',
        },
      });
    });

    it('should merge with existing langsmith metadata', () => {
      const updater = withLangsmithMetadata({
        tags: ['new-tag'],
      });
      const result = updater({
        metadata: {
          langsmith: {
            projectName: 'existing-project',
          },
        },
      });

      expect(result.metadata).toEqual({
        langsmith: {
          projectName: 'existing-project',
          tags: ['new-tag'],
        },
      });
    });
  });
});
