import { describe, expect, it } from 'vitest';
import { embeddedDocsTools } from '../embedded-docs';

const tools = Object.values(embeddedDocsTools).map(tool => ({
  name: tool.name,
  projectPathSchema: tool.parameters.shape.projectPath,
}));

describe('embedded docs project path validation', () => {
  it.each(tools)('rejects an empty project path for $name', ({ projectPathSchema }) => {
    const result = projectPathSchema.safeParse('');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ message: 'Project path cannot be empty' })]),
      );
    }
  });

  it.each(tools)('rejects a relative project path for $name', ({ projectPathSchema }) => {
    const result = projectPathSchema.safeParse('.');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ message: 'Project path must be absolute' })]),
      );
    }
  });

  it.each(tools)('accepts an absolute project path for $name', ({ projectPathSchema }) => {
    expect(projectPathSchema.safeParse('/tmp/mastra-project').success).toBe(true);
  });
});
