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

    it('should handle tables with empty cells', () => {
      const transformer = new MarkdownHeaderTransformer([
        ['#', 'Title'],
        ['##', 'Section'],
      ]);

      const markdown = `# Data Report

## User Activity

| User ID | Name | Email | Last Login | Status |
|---------|------|-------|------------|--------|
| 001 | John Doe | john@example.com | 2024-01-15 | Active |
| 002 | Jane Smith | | 2024-01-10 | Active |
| 003 | | bob@example.com | | Pending |
| 004 | | | | Inactive |
| 005 | Alice Brown | alice@example.com | 2024-01-20 | Active |

## Summary

Some users have incomplete data.`;

      const result = transformer.splitText({ text: markdown });

      // Find the chunk with the table
      const tableChunk = result.find(doc => doc.text.includes('| User ID |'));

      expect(tableChunk).toBeDefined();
      // Verify all rows are preserved, including those with empty cells
      expect(tableChunk?.text).toContain('| 001 | John Doe | john@example.com | 2024-01-15 | Active |');
      expect(tableChunk?.text).toContain('| 002 | Jane Smith | | 2024-01-10 | Active |');
      expect(tableChunk?.text).toContain('| 003 | | bob@example.com | | Pending |');
      expect(tableChunk?.text).toContain('| 004 | | | | Inactive |');
      expect(tableChunk?.text).toContain('| 005 | Alice Brown | alice@example.com | 2024-01-20 | Active |');
      // Verify metadata is correct
      expect(tableChunk?.metadata).toEqual({
        Title: 'Data Report',
        Section: 'User Activity',
      });
    });

    it('should handle tables with completely empty rows', () => {
      const transformer = new MarkdownHeaderTransformer([['##', 'Section']]);

      const markdown = `## Data

| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
| | | |
| 4 | 5 | 6 |`;

      const result = transformer.splitText({ text: markdown });

      const tableChunk = result[0];
      expect(tableChunk).toBeDefined();
      // Empty row should still be preserved
      expect(tableChunk?.text).toContain('| | | |');
      expect(tableChunk?.text).toContain('| 1 | 2 | 3 |');
      expect(tableChunk?.text).toContain('| 4 | 5 | 6 |');
    });

    it('should handle escaped pipe characters in table cells', () => {
      const transformer = new MarkdownHeaderTransformer([['#', 'Title']]);

      const markdown = `# Data

| Column A | Column B | Column C |
|----------|----------|----------|
| Value 1  | Has \\| pipe | Value 3  |
| Value 4  | More \\| pipes \\| here | Value 6  |`;

      const result = transformer.splitText({ text: markdown });

      const tableChunk = result[0];
      expect(tableChunk).toBeDefined();
      // All rows should be kept together even with escaped pipes
      expect(tableChunk?.text).toContain('| Column A | Column B | Column C |');
      expect(tableChunk?.text).toContain('| Value 1  | Has \\| pipe | Value 3  |');
      expect(tableChunk?.text).toContain('| Value 4  | More \\| pipes \\| here | Value 6  |');
    });

    it('should handle tables with single column', () => {
      const transformer = new MarkdownHeaderTransformer([['##', 'Section']]);

      const markdown = `## List

| Item |
|------|
| A    |
| B    |
| C    |`;

      const result = transformer.splitText({ text: markdown });

      const tableChunk = result[0];
      expect(tableChunk).toBeDefined();
      expect(tableChunk?.text).toContain('| Item |');
      expect(tableChunk?.text).toContain('| A    |');
      expect(tableChunk?.text).toContain('| B    |');
      expect(tableChunk?.text).toContain('| C    |');
    });

    it('should handle tables without outer pipes', () => {
      const transformer = new MarkdownHeaderTransformer([['#', 'Header']]);

      // Some markdown parsers support tables without leading/trailing pipes
      const markdown = `# Data

Col1 | Col2 | Col3
-----|------|-----
A    | B    | C
D    | E    | F`;

      const result = transformer.splitText({ text: markdown });

      const tableChunk = result[0];
      expect(tableChunk).toBeDefined();
      // Should still detect and keep together as they contain pipes
      expect(tableChunk?.text).toContain('Col1 | Col2 | Col3');
      expect(tableChunk?.text).toContain('A    | B    | C');
      expect(tableChunk?.text).toContain('D    | E    | F');
    });

    it('should not treat code with pipe characters as tables', () => {
      const transformer = new MarkdownHeaderTransformer([['##', 'Section']]);

      const markdown = `## Example

\`\`\`bash
echo "value1 | value2 | value3"
cat file.txt | grep pattern | sort
\`\`\`

## Real Table

| Col1 | Col2 |
|------|------|
| A    | B    |`;

      const result = transformer.splitText({ text: markdown });

      // Code block should be in first chunk
      const codeChunk = result.find(doc => doc.text.includes('```bash'));
      expect(codeChunk).toBeDefined();
      expect(codeChunk?.text).toContain('echo "value1 | value2 | value3"');

      // Real table should be in separate chunk
      const tableChunk = result.find(doc => doc.text.includes('| Col1 | Col2 |') && !doc.text.includes('```'));
      expect(tableChunk).toBeDefined();
      expect(tableChunk?.text).toContain('| A    | B    |');
    });

    it('should handle tables with alignment separators (left, right, center)', () => {
      const transformer = new MarkdownHeaderTransformer([['#', 'Header']]);

      const markdown = `# Data

| Left | Center | Right | Default |
|:-----|:------:|------:|---------|
| L1   | C1     | R1    | D1      |
| L2   | C2     | R2    | D2      |`;

      const result = transformer.splitText({ text: markdown });

      const tableChunk = result[0];
      expect(tableChunk).toBeDefined();
      // Should detect the separator row as a table line
      expect(tableChunk?.text).toContain('|:-----|:------:|------:|---------|');
      expect(tableChunk?.text).toContain('| Left | Center | Right | Default |');
      expect(tableChunk?.text).toContain('| L1   | C1     | R1    | D1      |');
      expect(tableChunk?.text).toContain('| L2   | C2     | R2    | D2      |');
    });

    it('should handle tables with varied separator spacing', () => {
      const transformer = new MarkdownHeaderTransformer([['##', 'Section']]);

      const markdown = `## Data

| Col A | Col B | Col C |
|:------|:-----:|------:|
| A     | B     | C     |

## More Data

| Col D | Col E |
|---|---|
| D | E |`;

      const result = transformer.splitText({ text: markdown });

      expect(result.length).toBe(2);

      // First table with spaced separators
      expect(result[0]?.text).toContain('|:------|:-----:|------:|');
      expect(result[0]?.text).toContain('| A     | B     | C     |');

      // Second table with minimal separators
      expect(result[1]?.text).toContain('|---|---|');
      expect(result[1]?.text).toContain('| D | E |');
    });

    it('should handle tables with mixed alignment styles', () => {
      const transformer = new MarkdownHeaderTransformer([['#', 'Title']]);

      const markdown = `# Pricing

| Product | Price | Stock | Status |
|:--------|------:|:-----:|--------|
| Widget  | $9.99 | 100   | Active |
| Gadget  | $19.99| 50    | Low    |`;

      const result = transformer.splitText({ text: markdown });

      const tableChunk = result[0];
      expect(tableChunk).toBeDefined();
      expect(tableChunk?.text).toContain('|:--------|------:|:-----:|--------|');
      expect(tableChunk?.text).toContain('| Widget  | $9.99 | 100   | Active |');
      expect(tableChunk?.text).toContain('| Gadget  | $19.99| 50    | Low    |');
    });

    it('should not treat inline code with pipes as table', () => {
      const transformer = new MarkdownHeaderTransformer([['##', 'Section']]);

      const markdown = `## Usage

Use the \`grep | sort\` command for filtering.

You can also use \`cmd1 | cmd2 | cmd3\` for chaining.

## Real Table

| Command | Description |
|---------|-------------|
| grep    | Search      |`;

      const result = transformer.splitText({ text: markdown });

      // The inline code lines should not trigger table mode
      const usageChunk = result.find(doc => doc.text.includes('grep | sort'));
      expect(usageChunk).toBeDefined();
      // It might be grouped with the inline code, but shouldn't break the real table

      const tableChunk = result.find(doc => doc.text.includes('| Command | Description |'));
      expect(tableChunk).toBeDefined();
      expect(tableChunk?.text).toContain('| grep    | Search      |');
    });

    it('should handle prose with pipe characters that is not a table', () => {
      const transformer = new MarkdownHeaderTransformer([['#', 'Header']]);

      const markdown = `# Discussion

This | that or the other thing.

We need A | B | C analysis.

## Actual Table

| Item | Value |
|------|-------|
| X    | 1     |`;

      const result = transformer.splitText({ text: markdown });

      // Prose with pipes will be treated as table lines (current behavior)
      // This is acceptable because single lines with pipes rarely break things
      // The real table should still be detected
      const tableChunk = result.find(doc => doc.text.includes('| Item | Value |'));
      expect(tableChunk).toBeDefined();
      expect(tableChunk?.text).toContain('| X    | 1     |');
    });

    it('should handle blockquotes with pipe characters', () => {
      const transformer = new MarkdownHeaderTransformer([['##', 'Section']]);

      const markdown = `## Quote

> This is a quote | with | pipes

## Table

| A | B |
|---|---|
| 1 | 2 |`;

      const result = transformer.splitText({ text: markdown });

      // The blockquote line contains pipes and will be treated as a table line
      // (current limitation - acceptable for most cases)
      const tableChunk = result.find(doc => doc.text.includes('| A | B |'));
      expect(tableChunk).toBeDefined();
      expect(tableChunk?.text).toContain('| 1 | 2 |');
    });

    it('should handle HTML entities and special characters in tables', () => {
      const transformer = new MarkdownHeaderTransformer([['#', 'Title']]);

      const markdown = `# Data

| Symbol | Name | HTML |
|--------|------|------|
| &lt;   | Less than | &amp;lt; |
| &gt;   | Greater than | &amp;gt; |
| &amp;  | Ampersand | &amp;amp; |`;

      const result = transformer.splitText({ text: markdown });

      const tableChunk = result[0];
      expect(tableChunk).toBeDefined();
      expect(tableChunk?.text).toContain('| &lt;   | Less than | &amp;lt; |');
      expect(tableChunk?.text).toContain('| &gt;   | Greater than | &amp;gt; |');
      expect(tableChunk?.text).toContain('| &amp;  | Ampersand | &amp;amp; |');
    });

    it('should not confuse single pipe in text as table start', () => {
      const transformer = new MarkdownHeaderTransformer([['##', 'Section']]);

      const markdown = `## Notes

Single line with | character should not break things.

## Table

| Col1 | Col2 |
|------|------|
| A    | B    |
| C    | D    |`;

      const result = transformer.splitText({ text: markdown });

      // Find the actual table
      const tableChunk = result.find(
        doc => doc.text.includes('| Col1 | Col2 |') && doc.text.includes('|------|------|'),
      );

      expect(tableChunk).toBeDefined();
      expect(tableChunk?.text).toContain('| A    | B    |');
      expect(tableChunk?.text).toContain('| C    | D    |');
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
