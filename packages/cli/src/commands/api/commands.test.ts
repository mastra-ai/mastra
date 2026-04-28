import { describe, expect, it } from 'vitest';
import { API_COMMANDS } from './commands.js';

describe('API_COMMANDS invariants', () => {
  it('keeps every descriptor internally consistent', () => {
    for (const [key, command] of Object.entries(API_COMMANDS)) {
      expect(command.key).toBe(key);
      expect(command.name).not.toBe('');
      expect(command.description).not.toBe('');
      expect(command.path).toMatch(/^\//);
      expect(['GET', 'POST', 'PATCH', 'DELETE']).toContain(command.method);

      if (command.inputRequired) expect(command.acceptsInput).toBe(true);
      if (command.method === 'GET') expect(command.bodyParams).toEqual([]);
      if (command.list) expect(command.acceptsInput).toBe(true);
    }
  });

  it('requires JSON input for commands whose required identity lives in query params', () => {
    for (const key of [
      'threadCreate',
      'threadUpdate',
      'threadDelete',
      'memoryCurrentUpdate',
      'memoryStatus',
    ] as const) {
      expect(API_COMMANDS[key]).toMatchObject({ acceptsInput: true, inputRequired: true });
      expect(API_COMMANDS[key].queryParams.length).toBeGreaterThan(0);
    }
  });
});
