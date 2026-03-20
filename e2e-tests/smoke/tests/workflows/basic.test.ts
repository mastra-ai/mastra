import { describe, it, expect } from 'vitest';
import { startWorkflow } from '../utils.js';

describe('basic workflows', () => {
  describe('sequential-steps', () => {
    it('should chain 3 steps and produce combined message', async () => {
      const { data } = await startWorkflow('sequential-steps', {
        inputData: { name: 'Alice' },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual({ message: 'Hello, Alice! Goodbye, Alice!' });
    });
  });

  describe('schema-validation', () => {
    it('should succeed with valid input', async () => {
      const { data } = await startWorkflow('schema-validation', {
        inputData: { value: 21 },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual({ result: 42 });
    });

    it('should reject invalid input (value too high)', async () => {
      const { status, data } = await startWorkflow('schema-validation', {
        inputData: { value: 200 },
      });

      expect(status).toBe(500);
      expect(data.error).toContain('Too big');
      expect(data.error).toContain('<=100');
    });

    it('should reject invalid input (wrong type)', async () => {
      const { status, data } = await startWorkflow('schema-validation', {
        inputData: { value: 'not-a-number' },
      });

      expect(status).toBe(500);
      expect(data.error).toContain('expected number, received string');
    });

    it('should accept boundary value 0 (minimum)', async () => {
      const { data } = await startWorkflow('schema-validation', {
        inputData: { value: 0 },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual({ result: 0 });
    });

    it('should accept boundary value 100 (maximum)', async () => {
      const { data } = await startWorkflow('schema-validation', {
        inputData: { value: 100 },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual({ result: 200 });
    });

    it('should reject value below minimum', async () => {
      const { status, data } = await startWorkflow('schema-validation', {
        inputData: { value: -1 },
      });

      expect(status).toBe(500);
      expect(data.error).toContain('Too small');
    });
  });

  describe('map-between-steps', () => {
    it('should map fullName to displayName between steps', async () => {
      const { data } = await startWorkflow('map-between-steps', {
        inputData: { firstName: 'John', lastName: 'Doe' },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual({ formatted: 'User: John Doe' });
    });
  });
});
