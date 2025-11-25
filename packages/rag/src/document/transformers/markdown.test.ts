import { describe, it, expect } from 'vitest';
import { MarkdownHeaderTransformer, MarkdownTransformer } from './markdown';

describe('MarkdownHeaderTransformer', () => {
  describe('table support', () => {
    it('should keep tables together when splitting markdown', () => {
      const transformer = new MarkdownHeaderTransformer([
        ['#', 'Header 1'],
        ['##', 'Header 2'],
      ]);

      const markdown = `# Introduction

This is some intro text.

## Data Table

Here is a table:

| Name | Age | City |
|------|-----|------|
| John | 30  | NYC  |
| Jane | 25  | LA   |
| Bob  | 35  | SF   |

## Conclusion

This is the conclusion.`;

      const result = transformer.splitText({ text: markdown });

      // Find the chunk with the table
      const tableChunk = result.find(doc => doc.text.includes('| Name | Age | City |'));

      expect(tableChunk).toBeDefined();
      // Verify the entire table is in one chunk
      expect(tableChunk?.text).toContain('| Name | Age | City |');
      expect(tableChunk?.text).toContain('|------|-----|------|');
      expect(tableChunk?.text).toContain('| John | 30  | NYC  |');
      expect(tableChunk?.text).toContain('| Jane | 25  | LA   |');
      expect(tableChunk?.text).toContain('| Bob  | 35  | SF   |');
    });

    it('should handle tables without surrounding text', () => {
      const transformer = new MarkdownHeaderTransformer([['##', 'Header']]);

      const markdown = `## Table Section

| Col1 | Col2 |
|------|------|
| A    | B    |`;

      const result = transformer.splitText({ text: markdown });

      expect(result.length).toBeGreaterThan(0);
      const chunk = result[0];
      expect(chunk?.text).toContain('| Col1 | Col2 |');
      expect(chunk?.text).toContain('| A    | B    |');
    });

    it('should handle multiple tables in different sections', () => {
      const transformer = new MarkdownHeaderTransformer([['##', 'Section']]);

      const markdown = `## First Section

| A | B |
|---|---|
| 1 | 2 |

## Second Section

| C | D |
|---|---|
| 3 | 4 |`;

      const result = transformer.splitText({ text: markdown });

      expect(result.length).toBe(2);
      expect(result[0]?.text).toContain('| A | B |');
      expect(result[0]?.text).toContain('| 1 | 2 |');
      expect(result[1]?.text).toContain('| C | D |');
      expect(result[1]?.text).toContain('| 3 | 4 |');
    });

    it('should not split tables across chunks', () => {
      const transformer = new MarkdownHeaderTransformer([['#', 'Header']]);

      const markdown = `# Section

Before table text.

| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Row 1 A  | Row 1 B  | Row 1 C  |
| Row 2 A  | Row 2 B  | Row 2 C  |
| Row 3 A  | Row 3 B  | Row 3 C  |

After table text.`;

      const result = transformer.splitText({ text: markdown });

      // All table rows should be in the same chunk
      const chunkWithTable = result.find(doc => doc.text.includes('| Header 1 | Header 2 | Header 3 |'));
      expect(chunkWithTable).toBeDefined();
      expect(chunkWithTable?.text).toContain('| Row 1 A  | Row 1 B  | Row 1 C  |');
      expect(chunkWithTable?.text).toContain('| Row 2 A  | Row 2 B  | Row 2 C  |');
      expect(chunkWithTable?.text).toContain('| Row 3 A  | Row 3 B  | Row 3 C  |');
    });

    it('should handle tables within code blocks correctly', () => {
      const transformer = new MarkdownHeaderTransformer([['##', 'Section']]);

      const markdown = `## Code Example

\`\`\`markdown
| Fake | Table |
|------|-------|
| In   | Code  |
\`\`\`

## Real Table

| Real | Table |
|------|-------|
| With | Data  |`;

      const result = transformer.splitText({ text: markdown });

      // The code block should be treated as code, not as a table
      const codeChunk = result.find(doc => doc.text.includes('```markdown'));
      expect(codeChunk).toBeDefined();
      expect(codeChunk?.text).toContain('| Fake | Table |');

      // The real table should also be present
      const tableChunk = result.find(doc => doc.text.includes('| Real | Table |') && !doc.text.includes('```'));
      expect(tableChunk).toBeDefined();
      expect(tableChunk?.text).toContain('| With | Data  |');
    });

    it('should handle empty lines within table context', () => {
      const transformer = new MarkdownHeaderTransformer([['#', 'Header']]);

      const markdown = `# Data

| Col1 | Col2 |
|------|------|
| A    | B    |
| C    | D    |

After the table.`;

      const result = transformer.splitText({ text: markdown });

      const tableChunk = result.find(doc => doc.text.includes('| Col1 | Col2 |'));
      expect(tableChunk).toBeDefined();
      expect(tableChunk?.text).toContain('| A    | B    |');
      expect(tableChunk?.text).toContain('| C    | D    |');
      // The "After the table" should be in the same chunk since it's under the same header
      expect(tableChunk?.text).toContain('After the table.');
    });
  });

  describe('metadata', () => {
    it('should preserve header metadata for chunks with tables', () => {
      const transformer = new MarkdownHeaderTransformer([
        ['#', 'Title'],
        ['##', 'Section'],
      ]);

      const markdown = `# My Document

## Introduction

| Feature | Status |
|---------|--------|
| Tables  | Added  |`;

      const result = transformer.splitText({ text: markdown });

      const tableChunk = result.find(doc => doc.text.includes('| Feature | Status |'));
      expect(tableChunk).toBeDefined();
      expect(tableChunk?.metadata).toEqual({
        Title: 'My Document',
        Section: 'Introduction',
      });
    });
  });
});

describe('MarkdownTransformer', () => {
  it('should handle markdown with tables using recursive character splitting', () => {
    const transformer = new MarkdownTransformer({ maxSize: 1000 });

    const markdown = `# Introduction

Some text before the table.

| Name | Value |
|------|-------|
| A    | 1     |
| B    | 2     |

Some text after the table.`;

    const docs = transformer.createDocuments([markdown]);

    expect(docs.length).toBeGreaterThan(0);
    // At least one document should contain table content
    const hasTableContent = docs.some(doc => doc.text.includes('|') && doc.text.includes('Name'));
    expect(hasTableContent).toBe(true);
  });
});
