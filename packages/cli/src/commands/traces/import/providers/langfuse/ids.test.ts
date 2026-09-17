import { describe, expect, it } from 'vitest';

import { createLangfuseSpanImportId, createLangfuseTraceImportId } from './ids.js';

describe('Langfuse import IDs', () => {
  it('keeps the versioned deterministic ID strategy stable', async () => {
    await expect(createLangfuseTraceImportId('project-1', 'trace-1')).resolves.toBe('e24f0e8ae0ea8423ad3b20aa25821bff');
    await expect(createLangfuseSpanImportId('project-1', 'root')).resolves.toBe('8abe9fdc27cd4e38');
  });
});
