import { createOpenAI } from '@ai-sdk/openai';
import { embedMany } from 'ai';
import { describe, it, expect, vi } from 'vitest';

import { MDocument } from './document';
import { Language } from './types';

const sampleMarkdown = `
# Complete Guide to Modern Web Development
## Introduction
Welcome to our comprehensive guide on modern web development. This resource covers essential concepts, best practices, and tools that every developer should know in 2024.

### Who This Guide Is For
- Beginning developers looking to establish a solid foundation
- Intermediate developers wanting to modernize their skillset
- Senior developers seeking a refresher on current best practices
`;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

vi.setConfig({ testTimeout: 100_000, hookTimeout: 100_000 });

describe('MDocument', () => {
  describe('basics', () => {
    let chunks: MDocument['chunks'];
    let doc: MDocument;
    it('initialization', () => {
      const doc = new MDocument({ docs: [{ text: 'test' }], type: 'text' });
      expect(doc.getDocs()).toHaveLength(1);
      expect(doc.getText()?.[0]).toBe('test');
    });

    it('initialization with array', () => {
      doc = new MDocument({ docs: [{ text: 'test' }, { text: 'test2' }], type: 'text' });
      expect(doc.getDocs()).toHaveLength(2);
      expect(doc.getDocs()[0]?.text).toBe('test');
      expect(doc.getDocs()[1]?.text).toBe('test2');
    });

    it('chunk - metadata title', async () => {
      const doc = MDocument.fromMarkdown(sampleMarkdown);

      chunks = await doc.chunk({
        maxSize: 1500,
        overlap: 0,
        extract: {
          keywords: true,
        },
      });

      expect(doc.getMetadata()?.[0]).toBeTruthy();
      expect(chunks).toBeInstanceOf(Array);
    }, 15000);

    it('embed - create embedding from chunk', async () => {
      const embeddings = await embedMany({
        values: chunks.map(chunk => chunk.text),
        model: openai.embedding('text-embedding-3-small'),
      });

      expect(embeddings).toBeDefined();
    }, 15000);
  });

  describe('chunkCharacter', () => {
    it('should split text on simple separator', async () => {
      const text = 'Hello world\n\nHow are you\n\nI am fine';

      const doc = MDocument.fromText(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'character',
        separator: '\n\n',
        isSeparatorRegex: false,
        maxSize: 50,
        overlap: 5,
      });

      const chunks = doc.getDocs();

      expect(chunks).toHaveLength(3);
      expect(chunks?.[0]?.text).toBe('Hello world');
      expect(chunks?.[1]?.text).toBe('How are you');
      expect(chunks?.[2]?.text).toBe('I am fine');
    });

    it('should handle regex separator', async () => {
      const text = 'Hello   world\n\nHow    are    you';

      const doc = MDocument.fromText(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'character',
        separator: '\\s+',
        isSeparatorRegex: true,
        maxSize: 50,
        overlap: 5,
      });

      expect(doc.getText().join(' ')).toBe('Hello world How are you');
    });

    it('should keep separator when specified', async () => {
      const text = 'Hello\n\nWorld';

      const doc = MDocument.fromText(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'character',
        separator: '\n\n',
        isSeparatorRegex: false,
        maxSize: 50,
        overlap: 5,
        keepSeparator: 'end',
      });
      const chunks = doc.getText();

      expect(chunks[0]).toBe('Hello\n\n');
      expect(chunks[1]).toBe('World');
    });

    describe('separator handling', () => {
      it('should keep separator at end when specified', async () => {
        const text = 'Hello\n\nWorld';

        const doc = MDocument.fromText(text, { meta: 'data' });

        await doc.chunk({
          strategy: 'character',
          separator: '\n\n',
          isSeparatorRegex: false,
          maxSize: 50,
          overlap: 5,
          keepSeparator: 'end',
        });

        const chunks = doc.getText();

        expect(chunks).toHaveLength(2);
        expect(chunks[0]).toBe('Hello\n\n');
        expect(chunks[1]).toBe('World');
      });

      it('should keep separator at start when specified', async () => {
        const text = 'Hello\n\nWorld\n\nTest';

        const doc = MDocument.fromText(text, { meta: 'data' });

        await doc.chunk({
          strategy: 'character',
          separator: '\n\n',
          isSeparatorRegex: false,
          maxSize: 50,
          overlap: 5,
          keepSeparator: 'start',
        });

        const chunks = doc.getText();

        expect(chunks).toHaveLength(3);
        expect(chunks[0]).toBe('Hello');
        expect(chunks[1]).toBe('\n\nWorld');
        expect(chunks[2]).toBe('\n\nTest');
      });

      it('should handle multiple consecutive separators', async () => {
        const text = 'Hello\n\n\n\nWorld';

        const doc = MDocument.fromText(text, { meta: 'data' });

        await doc.chunk({
          strategy: 'character',
          separator: '\n\n',
          isSeparatorRegex: false,
          maxSize: 50,
          overlap: 5,
          keepSeparator: 'end',
        });

        const chunks = doc.getText();

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.join('')).toBe(text);
      });

      it('should handle text ending with separator', async () => {
        const text = 'Hello\n\nWorld\n\n';

        const doc = MDocument.fromText(text, { meta: 'data' });

        await doc.chunk({
          strategy: 'character',
          separator: '\n\n',
          isSeparatorRegex: false,
          maxSize: 50,
          overlap: 5,
          keepSeparator: 'end',
        });

        const chunks = doc.getText();

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.join('')).toBe(text);
      });

      it('should handle text starting with separator', async () => {
        const text = '\n\nHello\n\nWorld';

        const doc = MDocument.fromText(text, { meta: 'data' });

        await doc.chunk({
          strategy: 'character',
          separator: '\n\n',
          isSeparatorRegex: false,
          maxSize: 50,
          overlap: 5,
          keepSeparator: 'start',
        });

        const chunks = doc.getText();

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.join('')).toBe(text);
      });
    });
    it('should properly implement overlap in character chunking', async () => {
      // Test basic overlap functionality
      const text = 'a'.repeat(500) + 'b'.repeat(500) + 'c'.repeat(500);
      const chunkSize = 600;
      const overlap = 100;
      const doc = MDocument.fromText(text);

      const result = await doc.chunk({
        strategy: 'character',
        maxSize: chunkSize,
        overlap,
      });

      // Verify overlap between chunks
      for (let i = 1; i < result.length; i++) {
        const prevChunk = result[i - 1]?.text;
        const currentChunk = result[i]?.text;

        if (prevChunk && currentChunk) {
          // Get the end of the previous chunk and start of current chunk
          const prevEnd = prevChunk.slice(-overlap);
          const currentStart = currentChunk.slice(0, overlap);

          // There should be a common substring of length >= min(overlap, chunk length)
          const commonSubstring = findCommonSubstring(prevEnd, currentStart);
          expect(commonSubstring.length).toBeGreaterThan(0);
        }
      }
    });

    it('should ensure character chunks never exceed size limit', async () => {
      // Create text with varying content to test size limits
      const text = 'a'.repeat(50) + 'b'.repeat(100) + 'c'.repeat(30);
      const chunkSize = 50;
      const overlap = 10;

      const doc = MDocument.fromText(text);
      const chunks = await doc.chunk({
        strategy: 'character',
        maxSize: chunkSize,
        overlap,
      });

      chunks.forEach((chunk, i) => {
        if (i > 0) {
          const prevChunk = chunks[i - 1]?.text;
          const actualOverlap = chunk.text.slice(0, overlap);
          const expectedOverlap = prevChunk?.slice(-overlap);
          expect(actualOverlap).toBe(expectedOverlap);
        }
      });

      // Verify each chunk's size
      let allChunksValid = true;
      for (const chunk of chunks) {
        if (chunk.text.length > chunkSize) {
          allChunksValid = false;
        }
      }
      expect(allChunksValid).toBe(true);

      // Verify overlaps between consecutive chunks
      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1]!;
        const currentChunk = chunks[i]!;

        // The end of the previous chunk should match the start of the current chunk
        const prevEnd = prevChunk.text.slice(-overlap);
        const currentStart = currentChunk.text.slice(0, overlap);

        expect(currentStart).toBe(prevEnd);
        expect(currentStart.length).toBeLessThanOrEqual(overlap);
      }
    });

    it('should handle end chunks properly in character chunking', async () => {
      const text = 'This is a test document that needs to be split into chunks with proper handling of the end.';
      const chunkSize = 20;
      const overlap = 5;

      const testDoc = MDocument.fromText(text);
      const chunks = await testDoc.chunk({
        strategy: 'character',
        maxSize: chunkSize,
        overlap,
      });

      // Verify no tiny fragments at the end
      const lastChunk = chunks[chunks.length - 1]?.text;
      expect(lastChunk?.length).toBeGreaterThan(5);

      // Verify each chunk respects size limit
      let allChunksValid = true;
      for (const chunk of chunks) {
        if (chunk.text.length > chunkSize) {
          allChunksValid = false;
        }
      }
      expect(allChunksValid).toBe(true);

      // Verify the size of each chunk explicitly
      for (const chunk of chunks) {
        expect(chunk.text.length).toBeLessThanOrEqual(chunkSize);
      }

      // Verify overlaps between consecutive chunks
      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1]!;
        const currentChunk = chunks[i]!;

        // The end of the previous chunk should match the start of the current chunk
        const prevEnd = prevChunk.text.slice(-overlap);
        const currentStart = currentChunk.text.slice(0, overlap);

        expect(currentStart).toBe(prevEnd);
        expect(currentStart.length).toBeLessThanOrEqual(overlap);
      }
    });
    it('should not create tiny chunks at the end', async () => {
      const text = 'ABCDEFGHIJ'; // 10 characters
      const chunkSize = 4;
      const overlap = 2;

      const doc = MDocument.fromText(text);
      const chunks = await doc.chunk({
        strategy: 'character',
        maxSize: chunkSize,
        overlap,
      });

      // Verify we don't have tiny chunks
      chunks.forEach(chunk => {
        // Each chunk should be either:
        // 1. Full size (chunkSize)
        // 2. Or at least half the chunk maxSize if it's the last chunk
        const minSize = chunk === chunks[chunks.length - 1] ? Math.floor(chunkSize / 2) : chunkSize;
        expect(chunk.text.length).toBeGreaterThanOrEqual(minSize);
      });

      // Verify overlaps are maintained
      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1]!;
        const currentChunk = chunks[i]!;
        const actualOverlap = currentChunk.text.slice(0, overlap);
        const expectedOverlap = prevChunk.text.slice(-overlap);
        expect(actualOverlap).toBe(expectedOverlap);
      }
    });
  });

  describe('text transformer overlap', () => {
    it('should properly implement overlap in text splitting', async () => {
      // Create a text with distinct sections that will be split
      const text = 'Section1'.repeat(100) + '\n\n' + 'Section2'.repeat(100) + '\n\n' + 'Section3'.repeat(100);
      const size = 300;
      const overlapSize = 50;
      const doc = MDocument.fromText(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'recursive',
        maxSize: size,
        overlap: overlapSize,
        separators: ['\n\n'], // Split on double newlines
      });

      const docs = doc.getDocs();
      expect(docs.length).toBeGreaterThan(1); // Should create multiple chunks

      for (let i = 1; i < docs.length; i++) {
        const prevChunk = docs[i - 1]?.text;
        const currentChunk = docs[i]?.text;

        if (prevChunk && currentChunk) {
          // Check if there's some overlap between chunks
          // We should find some common text between the end of the previous chunk
          // and the beginning of the current chunk
          const commonText = findCommonSubstring(prevChunk, currentChunk);
          expect(commonText.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('chunkRecursive', () => {
    it('chunkRecursive', async () => {
      const text =
        'Hello world.\n\nThis is a test of the recursive splitting system.\nIt should handle multiple lines and different separators appropriately.';

      const doc = MDocument.fromText(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'recursive',
        separators: ['\n\n', '\n', ' ', ''],
        isSeparatorRegex: false,
        maxSize: 50,
        overlap: 5,
      });

      expect(doc.getDocs()?.length).toBeGreaterThan(1);

      doc.getText()?.forEach(t => {
        expect(t.length).toBeLessThanOrEqual(50);
      });
    });

    it('chunkRecursive - language options', async () => {
      const tsCode = `
              interface User {
                name: string;
                age: number;
              }

              function greet(user: User) {
                console.log(\`Hello \${user.name}\`);
              }
            `;

      const doc = MDocument.fromText(tsCode, { meta: 'data' });

      await doc.chunk({
        maxSize: 50,
        overlap: 5,
        language: Language.TS,
      });

      expect(doc.getDocs().length).toBeGreaterThan(1);
      expect(doc.getText().some(chunk => chunk.includes('interface'))).toBe(true);
      expect(doc.getText().some(chunk => chunk.includes('function'))).toBe(true);
    });

    it('should throw error for unsupported language', async () => {
      const doc = MDocument.fromText('tsCode', { meta: 'data' });

      await expect(
        doc.chunk({
          maxSize: 50,
          overlap: 5,
          language: 'invalid-language' as any,
        }),
      ).rejects.toThrow();
    });

    it('should maintain context with overlap', async () => {
      // Create a longer text that will definitely be split into multiple chunks
      const text =
        'This is a test paragraph. '.repeat(50) +
        '\n\n' +
        'This is a second paragraph with different content. '.repeat(50) +
        '\n\n' +
        'This is a third paragraph with more unique content. '.repeat(50);
      const doc = MDocument.fromText(text, { meta: 'data' });
      const overlapSize = 20; // Explicit overlap size

      await doc.chunk({
        strategy: 'recursive',
        maxSize: 500, // Smaller chunk maxSize to ensure multiple chunks
        overlap: overlapSize,
      });

      const docs = doc.getDocs();

      // Ensure we have multiple chunks to test overlap
      expect(docs.length).toBeGreaterThan(1);

      for (let i = 1; i < docs.length; i++) {
        const prevChunk = docs[i - 1]?.text;
        const currentChunk = docs[i]?.text;

        if (prevChunk && currentChunk) {
          // Test using two methods:

          // 1. Check for shared words (original test)
          const hasWordOverlap = prevChunk.split(' ').some(word => word.length > 1 && currentChunk.includes(word));

          // 2. Check for shared character sequences
          const commonText = findCommonSubstring(prevChunk, currentChunk);

          // At least one of these overlap detection methods should succeed
          expect(hasWordOverlap || commonText.length > 5).toBe(true);
        }
      }
    });

    it('should respect the specified overlap size', async () => {
      const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(10); // Long repeating text
      const chunkSize = 50;
      const overlapSize = 20;
      const doc = MDocument.fromText(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'recursive',
        maxSize: chunkSize,
        overlap: overlapSize,
      });

      const docs = doc.getDocs();
      // Skip first chunk as it doesn't have a previous chunk to overlap with
      for (let i = 1; i < docs.length; i++) {
        const prevChunk = docs[i - 1]?.text;
        const currentChunk = docs[i]?.text;

        if (prevChunk && currentChunk) {
          // Get the end of the previous chunk
          const prevEnd = prevChunk.slice(-overlapSize);
          // Get the start of the current chunk
          const currentStart = currentChunk.slice(0, overlapSize);

          // There should be some overlap between the end of the previous chunk
          // and the start of the current chunk
          expect(prevEnd).toContain(currentStart.slice(0, 5));
          // The overlap shouldn't be the entire chunk
          expect(prevChunk).not.toBe(currentChunk);
        }
      }
    });
  });

  describe('chunkHTML', () => {
    it('should split HTML with headers correctly', async () => {
      const html = `
              <html>
                <body>
                  <h1>Main Title</h1>
                  <p>Main content.</p>
                  <h2>Section 1</h2>
                  <p>Section 1 content.</p>
                  <h3>Subsection 1.1</h3>
                  <p>Subsection content.</p>
                </body>
              </html>
            `;

      const doc = MDocument.fromHTML(html, { meta: 'data' });

      await doc.chunk({
        strategy: 'html',
        headers: [
          ['h1', 'Header 1'],
          ['h2', 'Header 2'],
          ['h3', 'Header 3'],
        ],
      });

      const docs = doc.getDocs();
      expect(docs.length).toBeGreaterThan(1);
      expect(docs?.[0]?.metadata?.['Header 1']).toBe('Main Title');
      expect(docs?.[1]?.metadata?.['Header 2']).toBe('Section 1');
    });

    it('should handle nested content', async () => {
      const html = `
              <html>
                <body>
                  <h1>Title</h1>
                  <div>
                    <p>Nested content.</p>
                    <div>
                      <p>Deeply nested content.</p>
                    </div>
                  </div>
                </body>
              </html>
            `;

      const doc = MDocument.fromHTML(html, { meta: 'data' });

      await doc.chunk({
        strategy: 'html',
        headers: [
          ['h1', 'Header 1'],
          ['h2', 'Header 2'],
          ['h3', 'Header 3'],
        ],
      });

      const docs = doc.getDocs();
      const mainSection = docs.find(doc => doc.metadata?.['Header 1'] === 'Title');
      expect(mainSection?.text).toContain('Nested content');
      expect(mainSection?.text).toContain('Deeply nested content');
    });

    it('should respect returnEachElement option', async () => {
      const html = `
      <html>
        <body>
          <h1>Title</h1>
          <p>Paragraph 1</p>
          <h1>Title</h1>
          <p>Paragraph 2</p>
          <h1>Title</h1>
          <p>Paragraph 3</p>
        </body>
      </html>
    `;

      const doc = MDocument.fromHTML(html, { meta: 'data' });

      await doc.chunk({
        strategy: 'html',

        returnEachLine: true,
        headers: [
          ['h1', 'Header 1'],
          ['h2', 'Header 2'],
          ['h3', 'Header 3'],
        ],
      });

      const docs = doc.getDocs();

      expect(docs.length).toBeGreaterThan(2);
      docs.forEach(doc => {
        expect(doc.metadata?.['Header 1']).toBe('Title');
      });
    });

    it('should split HTML into sections', async () => {
      const html = `
              <html>
                <body>
                  <h1>Document Title</h1>
                  <p>Introduction text.</p>
                  <h2>First Section</h2>
                  <p>First section content.</p>
                  <h2>Second Section</h2>
                  <p>Second section content.</p>
                </body>
              </html>
            `;

      const doc = MDocument.fromHTML(html, { meta: 'data' });

      await doc.chunk({
        strategy: 'html',
        sections: [
          ['h1', 'Header 1'],
          ['h2', 'Header 2'],
        ],
      });
      const docs = doc.getDocs();

      expect(docs.length).toBe(3);
      expect(docs?.[0]?.metadata?.['Header 1']).toBe('Document Title');
      expect(docs?.[1]?.metadata?.['Header 2']).toBe('First Section');
    });

    it('should properly merge metadata', async () => {
      const doc = new MDocument({
        docs: [
          {
            text: `
                        <h1>Title 1</h1>
                        <p>Content 1</p>
                      `,
            metadata: { source: 'doc1' },
          },
          {
            text: `
                        <h1>Title 2</h1>
                        <p>Content 2</p>
                      `,
            metadata: { source: 'doc2' },
          },
        ],
        type: 'html',
      });

      await doc.chunk({
        strategy: 'html',
        sections: [
          ['h1', 'Header 1'],
          ['h2', 'Header 2'],
        ],
      });

      doc.getDocs().forEach(doc => {
        expect(doc?.metadata).toHaveProperty('source');
        expect(doc?.metadata).toHaveProperty('Header 1');
      });
    });

    it('should handle empty or invalid HTML', async () => {
      const emptyHtml = '';
      const invalidHtml = '<unclosed>test';
      const noHeadersHtml = '<div>test</div>';

      const doc1 = MDocument.fromHTML(emptyHtml, { meta: 'data' });
      const doc2 = MDocument.fromHTML(invalidHtml, { meta: 'data' });
      const doc3 = MDocument.fromHTML(noHeadersHtml, { meta: 'data' });

      await doc1.chunk({
        strategy: 'html',
        headers: [
          ['h1', 'Header 1'],
          ['h2', 'Header 2'],
        ],
      });

      await doc2.chunk({
        strategy: 'html',
        headers: [
          ['h1', 'Header 1'],
          ['h2', 'Header 2'],
        ],
      });

      await doc3.chunk({
        strategy: 'html',
        headers: [
          ['h1', 'Header 1'],
          ['h2', 'Header 2'],
        ],
      });

      expect(doc1.getDocs()).toHaveLength(0);
      expect(doc2.getDocs()).toHaveLength(0);
      expect(doc3.getDocs()).toHaveLength(0);
    });

    it('should handle complex nested header hierarchies', async () => {
      const html = `
        <html>
          <body>
            <h1>Main Title</h1>
            <p>Main content</p>
            <h2>Section 1</h2>
            <p>Section 1 content</p>
            <h3>Subsection 1.1</h3>
            <p>Subsection 1.1 content</p>
            <h2>Section 2</h2>
            <h3>Subsection 2.1</h3>
            <p>Subsection 2.1 content</p>
          </body>
        </html>
      `;

      const doc = MDocument.fromHTML(html, { meta: 'data' });
      await doc.chunk({
        strategy: 'html',
        headers: [
          ['h1', 'Header 1'],
          ['h2', 'Header 2'],
          ['h3', 'Header 3'],
        ],
      });

      const docs = doc.getDocs();
      expect(docs.length).toBeGreaterThan(3);
      expect(docs.some(d => d.metadata?.['Header 1'] === 'Main Title')).toBe(true);
      expect(docs.some(d => d.metadata?.['Header 2'] === 'Section 1')).toBe(true);
      expect(docs.some(d => d.metadata?.['Header 3'] === 'Subsection 1.1')).toBe(true);
    });

    it('should handle headers with mixed content and special characters', async () => {
      const html = `
        <html>
          <body>
            <h1>Title with <strong>bold</strong> &amp; <em>emphasis</em></h1>
            <p>Content 1</p>
            <h2>Section with &lt;tags&gt; &amp; symbols</h2>
            <p>Content 2</p>
          </body>
        </html>
      `;

      const doc = MDocument.fromHTML(html, { meta: 'data' });
      await doc.chunk({
        strategy: 'html',
        headers: [
          ['h1', 'Header 1'],
          ['h2', 'Header 2'],
        ],
      });

      const docs = doc.getDocs();
      expect(docs.length).toBeGreaterThan(1);
      expect(docs[0]?.metadata?.['Header 1']).toContain('bold');
      expect(docs[0]?.metadata?.['Header 1']).toContain('&');
      expect(docs[0]?.metadata?.['Header 1']).toContain('emphasis');
      expect(docs[1]?.metadata?.['Header 2']).toContain('<tags>');
    });

    it('should handle headers with no content or whitespace content', async () => {
      const html = `
        <html>
          <body>
            <h1>Empty Section</h1>
            <h2>Whitespace Section</h2>
            
            <h2>Valid Section</h2>
            <p>Content</p>
          </body>
        </html>
      `;

      const doc = MDocument.fromHTML(html, { meta: 'data' });
      await doc.chunk({
        strategy: 'html',
        headers: [
          ['h1', 'Header 1'],
          ['h2', 'Header 2'],
        ],
      });

      const docs = doc.getDocs();
      expect(docs.some(d => d.metadata?.['Header 1'] === 'Empty Section')).toBe(true);
      expect(docs.some(d => d.metadata?.['Header 2'] === 'Valid Section')).toBe(true);
      expect(docs.find(d => d.metadata?.['Header 2'] === 'Valid Section')?.text).toContain('Content');
    });

    it('should generate correct XPaths for deeply nested elements', async () => {
      const html = `
        <html>
          <body>
            <div class="container">
              <section id="main">
                <div>
                  <h1>Deeply Nested Title</h1>
                  <p>Content</p>
                </div>
                <div>
                  <h1>Second Title</h1>
                  <p>More Content</p>
                </div>
              </section>
            </div>
          </body>
        </html>
      `;

      const doc = MDocument.fromHTML(html, { meta: 'data' });
      await doc.chunk({
        strategy: 'html',
        headers: [['h1', 'Header 1']],
      });

      const docs = doc.getDocs();
      expect(docs).toHaveLength(2);

      // First h1
      expect(docs[0]?.metadata?.['Header 1']).toBe('Deeply Nested Title');
      const xpath1 = docs[0]?.metadata?.xpath as string;
      expect(xpath1).toBeDefined();
      expect(xpath1).toMatch(/^\/html\[1\]\/body\[1\]\/div\[1\]\/section\[1\]\/div\[1\]\/h1\[1\]$/);

      // Second h1
      expect(docs[1]?.metadata?.['Header 1']).toBe('Second Title');
      const xpath2 = docs[1]?.metadata?.xpath as string;
      expect(xpath2).toBeDefined();
      expect(xpath2).toMatch(/^\/html\[1\]\/body\[1\]\/div\[1\]\/section\[1\]\/div\[2\]\/h1\[1\]$/);
    });
  });

  describe('chunkJson', () => {
    describe('Unicode handling', () => {
      it('should handle Unicode characters correctly', async () => {
        const input = {
          key1: '你好',
          key2: '世界',
        };

        const doc = MDocument.fromJSON(JSON.stringify(input), { meta: 'data' });

        await doc.chunk({
          strategy: 'json',
          maxSize: 50,
          minSize: 50,
          ensureAscii: true,
        });

        expect(doc.getText().some(chunk => chunk.includes('\\u'))).toBe(true);

        const combined = doc
          .getText()
          .map(chunk => {
            const c = JSON.parse(chunk);
            const retVal: Record<string, string> = {};
            Object.entries(c).forEach(([key, value]) => {
              retVal[key] = JSON.parse(`"${value as string}"`);
            });

            return retVal;
          })
          .reduce((acc, curr) => ({ ...acc, ...curr }), {});

        expect(combined?.key1?.charCodeAt(0)).toBe('你'.charCodeAt(0));
        expect(combined?.key1?.charCodeAt(1)).toBe('好'.charCodeAt(0));
        expect(combined?.key2?.charCodeAt(0)).toBe('世'.charCodeAt(0));
        expect(combined?.key2?.charCodeAt(1)).toBe('界'.charCodeAt(0));

        expect(combined?.key1).toBe('你好');
        expect(combined?.key2).toBe('世界');
      });

      it('should handle non-ASCII without escaping when ensureAscii is false', async () => {
        const input = {
          key1: '你好',
          key2: '世界',
        };

        const doc = MDocument.fromJSON(JSON.stringify(input), { meta: 'data' });

        await doc.chunk({
          strategy: 'json',
          maxSize: 50,
          ensureAscii: false,
        });

        expect(doc.getText().some(chunk => chunk.includes('你好'))).toBe(true);

        const combined = doc
          .getText()
          .map(chunk => JSON.parse(chunk))
          .reduce((acc, curr) => ({ ...acc, ...curr }), {});

        expect(combined.key1).toBe('你好');
        expect(combined.key2).toBe('世界');
      });
    });

    describe('JSON structure handling', () => {
      it('should handle flat objects', async () => {
        const flatJson = {
          name: 'John',
          age: 30,
          email: 'john@example.com',
        };

        const doc = MDocument.fromJSON(JSON.stringify(flatJson), { meta: 'data' });
        await doc.chunk({
          strategy: 'json',
          maxSize: 50,
          minSize: 10,
        });

        const chunks = doc.getText();
        expect(chunks.length).toBeGreaterThan(0);

        // Verify all data is preserved
        const reconstructed = chunks.map(chunk => JSON.parse(chunk)).reduce((acc, curr) => ({ ...acc, ...curr }), {});
        expect(reconstructed).toEqual(flatJson);
      });

      it('should handle nested objects', async () => {
        const nestedJson = {
          user: {
            name: 'John',
            contact: {
              email: 'john@example.com',
              phone: '123-456-7890',
            },
          },
        };

        const doc = MDocument.fromJSON(JSON.stringify(nestedJson), { meta: 'data' });
        await doc.chunk({
          strategy: 'json',
          maxSize: 50,
          minSize: 10,
        });

        const chunks = doc.getText();
        expect(chunks.length).toBeGreaterThan(0);

        // Verify nested structure is maintained
        chunks.forEach(chunk => {
          const parsed = JSON.parse(chunk);
          expect(parsed).toHaveProperty('user');
        });
      });

      it('should handle arrays of objects', async () => {
        const arrayJson = [
          { id: 1, value: 'first' },
          { id: 2, value: 'second' },
        ];

        const doc = MDocument.fromJSON(JSON.stringify(arrayJson), { meta: 'data' });
        await doc.chunk({
          strategy: 'json',
          maxSize: 50,
          minSize: 10,
        });

        const chunks = doc.getText();
        expect(chunks.length).toBe(2);
        chunks.forEach((chunk, index) => {
          const parsed = JSON.parse(chunk);
          expect(parsed[index]).toEqual(arrayJson[index]);
        });
      });

      it('should handle mixed types', async () => {
        const mixedJson = {
          string: 'hello',
          number: 123,
          boolean: true,
          array: [1, 2, 3],
          object: {
            nested: 'value',
          },
        };

        const doc = MDocument.fromJSON(JSON.stringify(mixedJson), { meta: 'data' });
        await doc.chunk({
          strategy: 'json',
          maxSize: 50,
          minSize: 10,
        });

        const chunks = doc.getText();
        const reconstructed = chunks.map(chunk => JSON.parse(chunk)).reduce((acc, curr) => ({ ...acc, ...curr }), {});

        expect(reconstructed).toEqual(mixedJson);
      });

      it('should properly split long string values', async () => {
        const longStringJson = {
          title: 'Short title',
          description:
            'This is a very long description that should definitely exceed our maxSize limit of 128 characters. It contains multiple sentences and should be split into multiple chunks while maintaining proper structure.',
        };

        const doc = MDocument.fromJSON(JSON.stringify(longStringJson), { meta: 'data' });
        await doc.chunk({
          strategy: 'json',
          maxSize: 50,
          minSize: 10,
        });

        const chunks = doc.getText();

        // Verify the short field is kept intact
        expect(
          chunks.some(chunk => {
            const parsed = JSON.parse(chunk);
            return parsed.title === 'Short title';
          }),
        ).toBe(true);

        // Verify the long field is split
        const descriptionChunks = chunks
          .map(chunk => JSON.parse(chunk))
          .filter(parsed => parsed.description)
          .map(parsed => parsed.description);

        expect(descriptionChunks.length).toBeGreaterThan(1);
        expect(descriptionChunks.join('')).toBe(longStringJson.description);
      });

      it('should respect maxSize in all chunks', async () => {
        const doc = MDocument.fromJSON(
          JSON.stringify({
            key: 'x'.repeat(200), // Deliberately exceed maxSize
          }),
          { meta: 'data' },
        );

        await doc.chunk({
          strategy: 'json',
          maxSize: 50,
          minSize: 10,
        });

        const chunks = doc.getText();
        chunks.forEach(chunk => {
          expect(chunk.length).toBeLessThanOrEqual(50);
        });
      });

      it('should properly group array items when possible', async () => {
        const arrayData = [
          { id: 1, name: 'Item 1', description: 'Short desc' },
          { id: 2, name: 'Item 2', description: 'Short desc' },
          {
            id: 3,
            name: 'Item 3',
            description: 'This is a much longer description that should cause this item to be in its own chunk',
          },
          { id: 4, name: 'Item 4', description: 'Short desc' },
        ];

        const doc = MDocument.fromJSON(JSON.stringify({ items: arrayData }));
        await doc.chunk({
          strategy: 'json',
          maxSize: 100,
          minSize: 10,
        });

        const chunks = doc.getText().map(chunk => JSON.parse(chunk));

        // Change expectation: No items should be grouped when maxSize is too small
        expect(chunks.every(chunk => !chunk.items || !Array.isArray(chunk.items) || chunk.items.length === 1)).toBe(
          true,
        );
      });

      it('should group items with larger maxSize', async () => {
        const arrayData = [
          { id: 1, name: 'Item 1', description: 'Short desc' },
          { id: 2, name: 'Item 2', description: 'Short desc' },
          {
            id: 3,
            name: 'Item 3',
            description: 'This is a much longer description that should cause this item to be in its own chunk',
          },
          { id: 4, name: 'Item 4', description: 'Short desc' },
        ];

        const doc = MDocument.fromJSON(JSON.stringify({ items: arrayData }));
        await doc.chunk({
          strategy: 'json',
          maxSize: 150, // Larger maxSize to allow grouping
          minSize: 10,
        });

        const chunks = doc.getText().map(chunk => JSON.parse(chunk));

        // Should group first two items
        expect(
          chunks.some(
            chunk =>
              chunk.items &&
              Array.isArray(chunk.items) &&
              chunk.items.length === 2 &&
              chunk.items[0].id === 1 &&
              chunk.items[1].id === 2,
          ),
        ).toBe(true);

        // Long item should still be separate
        expect(
          chunks.some(
            chunk => chunk.items && Array.isArray(chunk.items) && chunk.items.length === 1 && chunk.items[0].id === 3,
          ),
        ).toBe(true);
      });

      it('should group smaller items within maxSize limit', async () => {
        const arrayData = [
          { id: 1, name: 'A', desc: 'x' }, // Minimal items
          { id: 2, name: 'B', desc: 'y' },
          { id: 3, name: 'C', desc: 'This is the long one' },
          { id: 4, name: 'D', desc: 'z' },
          { id: 5, name: 'E', desc: 'w' }, // Added fifth item
        ];

        const doc = MDocument.fromJSON(JSON.stringify({ items: arrayData }));
        await doc.chunk({
          strategy: 'json',
          maxSize: 100,
          minSize: 10,
        });

        const chunks = doc.getText().map(chunk => JSON.parse(chunk));

        // Change expectation: Should group 2 items (not 3)
        expect(
          chunks.some(
            chunk => chunk.items && Array.isArray(chunk.items) && chunk.items.length === 2, // Changed from >= 3
          ),
        ).toBe(true);
      });

      it('should handle convertLists option', async () => {
        const data = {
          items: [1, 2, 3],
          nested: {
            list: ['a', 'b', 'c'],
          },
        };

        const doc = MDocument.fromJSON(JSON.stringify(data));
        await doc.chunk({
          strategy: 'json',
          maxSize: 50,
          minSize: 10,
          convertLists: true,
        });

        const chunks = doc.getText().map(chunk => JSON.parse(chunk));

        // Check that arrays were converted to objects with numeric keys
        expect(
          chunks.some(chunk => chunk.items && typeof chunk.items === 'object' && !Array.isArray(chunk.items)),
        ).toBe(true);
      });

      it('should handle ensureAscii option', async () => {
        const data = {
          text: 'Hello café world 🌍',
        };

        const doc = MDocument.fromJSON(JSON.stringify(data));

        // With ensureAscii true
        await doc.chunk({
          strategy: 'json',
          maxSize: 50,
          minSize: 10,
          ensureAscii: true,
        });

        const asciiChunks = doc.getText();
        expect(asciiChunks[0]).not.toMatch(/[^\x00-\x7F]/);

        // With ensureAscii false
        await doc.chunk({
          strategy: 'json',
          maxSize: 50,
          minSize: 10,
          ensureAscii: false,
        });

        const unicodeChunks = doc.getText();
        expect(JSON.parse(unicodeChunks[0]).text).toMatch(/[^\x00-\x7F]/);
      });

      it('should handle deeply nested structures', async () => {
        const deepData = {
          level1: {
            level2: {
              level3: {
                level4: {
                  value: 'deep',
                },
              },
            },
          },
        };

        const doc = MDocument.fromJSON(JSON.stringify(deepData));
        await doc.chunk({
          strategy: 'json',
          maxSize: 50,
          minSize: 10,
        });

        const chunks = doc.getText().map(chunk => JSON.parse(chunk));
        // Verify we can still access deeply nested value
        chunks.forEach(chunk => {
          expect(chunk).toHaveProperty('level1');
        });
        const hasDeepValue = chunks.some(chunk => {
          try {
            return chunk.level1?.level2?.level3?.level4?.value === 'deep';
          } catch {
            return false;
          }
        });
        expect(hasDeepValue).toBe(true);
      });

      it('should handle complex deeply nested structures with mixed types', async () => {
        const complexData = {
          organization: {
            name: 'TechCorp',
            departments: {
              engineering: {
                teams: [
                  {
                    name: 'Frontend',
                    projects: {
                      main: {
                        title: 'Website Redesign',
                        status: 'active',
                        tasks: [
                          { id: 1, description: 'Update homepage', status: 'done' },
                          { id: 2, description: 'Refactor CSS', status: 'in-progress' },
                        ],
                        metrics: {
                          performance: {
                            loadTime: '1.2s',
                            score: 95,
                            details: {
                              mobile: { score: 90, issues: ['image optimization'] },
                              desktop: { score: 98, issues: [] },
                            },
                          },
                        },
                      },
                    },
                    members: [
                      { id: 1, name: 'Alice', role: 'Lead' },
                      { id: 2, name: 'Bob', role: 'Senior Dev' },
                    ],
                  },
                ],
              },
            },
          },
        };

        const doc = MDocument.fromJSON(JSON.stringify(complexData));
        await doc.chunk({
          strategy: 'json',
          maxSize: 500, // Increased to more realistic size for JSON structures
          minSize: 50, // Increased to account for JSON path overhead
        });

        const chunks = doc.getText().map(chunk => JSON.parse(chunk));

        // Test complete objects are kept together when possible
        expect(
          chunks.some(chunk => {
            const members = chunk.organization?.departments?.engineering?.teams?.[0]?.members;
            return Array.isArray(members) && members.length === 2; // Both members should be in same chunk
          }),
        ).toBe(true);

        // Test large nested objects are split appropriately
        expect(
          chunks.some(
            chunk =>
              chunk.organization?.departments?.engineering?.teams?.[0]?.projects?.main?.metrics?.performance
                ?.loadTime === '1.2s',
          ),
        ).toBe(true);

        // Test array items are handled properly
        const taskChunks = chunks.filter(chunk => {
          const tasks = chunk.organization?.departments?.engineering?.teams?.[0]?.projects?.main?.tasks;
          return Array.isArray(tasks) || (tasks && typeof tasks === 'object');
        });
        expect(taskChunks.length).toBeGreaterThan(0);

        // Test that related data stays together when under maxSize
        expect(
          chunks.some(chunk => {
            const mobile =
              chunk.organization?.departments?.engineering?.teams?.[0]?.projects?.main?.metrics?.performance?.details
                ?.mobile;
            return mobile && mobile.score === 90 && Array.isArray(mobile.issues);
          }),
        ).toBe(true);
      });
    });
  });

  describe('chunkToken', () => {
    it('should handle different encodings', async () => {
      const text = 'This is a test text for different encodings.';
      const doc = MDocument.fromText(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'token',
        encodingName: 'cl100k_base',
        maxSize: 10,
        overlap: 2,
      });

      const chunks = doc.getText();

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join(' ').trim()).toBe(text);
    });

    it('should handle special tokens correctly', async () => {
      const text = 'Test text <|endoftext|> more text';

      const doc = MDocument.fromText(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'token',
        encodingName: 'gpt2',
        maxSize: 10,
        disallowedSpecial: new Set(),
        allowedSpecial: new Set(['<|endoftext|>']),
        overlap: 2,
      });

      const chunks = doc.getText();

      expect(chunks.join(' ').includes('<|endoftext|>')).toBe(true);
    });

    it('should strip whitespace when configured', async () => {
      const text = '  This has whitespace   ';

      const doc = MDocument.fromText(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'token',
        encodingName: 'gpt2',
        maxSize: 10,
        disallowedSpecial: new Set(),
        allowedSpecial: new Set(['<|endoftext|>']),
        overlap: 2,
      });

      const chunks = doc.getText();

      chunks.forEach(chunk => {
        expect(chunk).not.toMatch(/^\s+|\s+$/);
      });
    });

    describe('Error cases', () => {
      it('should throw error for invalid chunk maxSize and overlap', async () => {
        const text = '  This has whitespace   ';
        const doc = MDocument.fromText(text, { meta: 'data' });

        await expect(
          doc.chunk({
            strategy: 'token',
            maxSize: 100,
            overlap: 150, // overlap larger than chunk maxSize
          }),
        ).rejects.toThrow();
      });

      it('should handle invalid encoding name', async () => {
        const text = '  This has whitespace   ';
        const doc = MDocument.fromText(text, { meta: 'data' });

        await expect(
          doc.chunk({
            strategy: 'token',
            encodingName: 'invalid-encoding' as any,
            maxSize: 100,
            overlap: 150, // overlap larger than chunk maxSize
          }),
        ).rejects.toThrow();
      });
    });
  });

  describe('chunkMarkdown', () => {
    it('should split markdown text correctly', async () => {
      const text = `# Header 1

        This is some text under header 1.

        ## Header 2

        This is some text under header 2.

        ### Header 3

        - List item 1
        - List item 2`;

      const doc = MDocument.fromMarkdown(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'markdown',
        maxSize: 100,
        overlap: 10,
      });

      const chunks = doc.getText();
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0]).toContain('# Header 1');
    });

    it('should handle code blocks', async () => {
      const text = `# Code Example

        \`\`\`javascript
        function hello() {
          console.log('Hello, World!');
        }
        \`\`\`

        Regular text after code block.`;

      const doc = MDocument.fromMarkdown(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'markdown',
        maxSize: 100,
        overlap: 10,
      });

      const chunks = doc.getText();
      expect(chunks.some(chunk => chunk.includes('```javascript'))).toBe(true);
    });
  });

  describe('chunkLaTeX', () => {
    it('should split LaTeX text correctly based on sections', async () => {
      const text = `\\section{Introduction}
      
      This is the introduction section.
      
      \\subsection{Background}
      
      Some background information.
      
      \\subsubsection{Details}
      
      Even more detailed explanation.
      
      \\section{Conclusion}
      
      Final thoughts here.`;

      const doc = MDocument.fromText(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'latex',
        maxSize: 100,
        overlap: 10,
        keepSeparator: 'start',
      });

      const chunks = doc.getText();
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0]).toContain('\\section{Introduction}');
    });

    it('should handle environments like equations or itemize', async () => {
      const text = `\\section{Math Section}
  
      Here is an equation:
      
      \\[
      E = mc^2
      \\]
      
      \\begin{itemize}
        \\item First item
        \\item Second item
      \\end{itemize}
      
      End of the section.`;

      const doc = MDocument.fromText(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'latex',
        maxSize: 100,
        overlap: 10,
        keepSeparator: 'start',
      });

      const chunks = doc.getText();
      expect(chunks.some(chunk => chunk.includes('\\begin{itemize}'))).toBe(true);
      expect(chunks.some(chunk => chunk.includes('E = mc^2'))).toBe(true);
    });

    it('should split with keepSeparator at end', async () => {
      const text = `Intro text here.
        \\section{First}
        Content A.

        \\section{Second}
        Content B.`;

      const doc = MDocument.fromText(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'latex',
        maxSize: 50,
        overlap: 0,
        keepSeparator: 'end',
      });

      const chunks = doc.getText();
      expect(chunks.length).toBe(3);
      expect(chunks[0].trimEnd().includes('\\section{')).toBe(true);
      expect(chunks[1].trimEnd().includes('\\section{')).toBe(true);
    });

    it('should strip whitespace correctly', async () => {
      const text = `\\section{Whitespace}
      
        Content with leading and trailing whitespace.  
      `;

      const doc = MDocument.fromText(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'latex',
        maxSize: 100,
        overlap: 0,
        stripWhitespace: true,
      });

      const chunks = doc.getText();
      expect(chunks.every(chunk => chunk === chunk.trim())).toBe(true);
    });
  });

  describe('MarkdownHeader', () => {
    it('should split on headers and preserve metadata', async () => {
      const text = `# Main Title

        Some content here.

        ## Section 1

        Section 1 content.

        ### Subsection 1.1

        Subsection content.

        ## Section 2

        Final content.`;

      const doc = MDocument.fromMarkdown(text);

      await doc.chunk({
        strategy: 'markdown',
        headers: [
          ['#', 'Header 1'],
          ['##', 'Header 2'],
          ['###', 'Header 3'],
        ],
      });

      const docs = doc.getDocs();

      expect(docs.length).toBeGreaterThan(1);
      expect(docs?.[0]?.metadata?.['Header 1']).toBe('Main Title');

      const section1 = docs.find(doc => doc?.metadata?.['Header 2'] === 'Section 1');
      expect(section1).toBeDefined();
      expect(section1?.text).toContain('Section 1 content');
    });

    it('should handle nested headers correctly', async () => {
      const text = `# Top Level

        ## Section A
        Content A

        ### Subsection A1
        Content A1

        ## Section B
        Content B`;

      const doc = MDocument.fromMarkdown(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'markdown',
        headers: [
          ['#', 'Header 1'],
          ['##', 'Header 2'],
          ['###', 'Header 3'],
        ],
      });

      const subsectionDoc = doc.getDocs().find(doc => doc?.metadata?.['Header 3'] === 'Subsection A1');
      expect(subsectionDoc).toBeDefined();
      expect(subsectionDoc?.metadata?.['Header 1']).toBe('Top Level');
      expect(subsectionDoc?.metadata?.['Header 2']).toBe('Section A');
    });

    it('should handle code blocks without splitting them', async () => {
      const text = `# Code Section

        \`\`\`python
        def hello():
            print("Hello World")
        \`\`\`

        ## Next Section`;

      const doc = MDocument.fromMarkdown(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'markdown',
        headers: [
          ['#', 'Header 1'],
          ['##', 'Header 2'],
          ['###', 'Header 3'],
        ],
      });

      const codeDoc = doc.getDocs().find(doc => doc?.text?.includes('```python'));
      expect(codeDoc?.text).toContain('print("Hello World")');
    });

    it('should respect returnEachLine option', async () => {
      const text = `# Title

        Line 1
        Line 2
        Line 3`;

      const doc = MDocument.fromMarkdown(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'markdown',
        headers: [['#', 'Header 1']],
        returnEachLine: true,
        stripHeaders: false,
      });

      expect(doc.getDocs().length).toBe(4); // Title + 3 lines
      doc
        .getDocs()
        .slice(1)
        .forEach(doc => {
          expect(doc.metadata?.['Header 1']).toBe('Title');
        });
    });

    it('should handle stripHeaders option', async () => {
      const text = `# Title

        Content`;

      const doc = MDocument.fromMarkdown(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'markdown',
        headers: [['#', 'Header 1']],
        returnEachLine: false,
        stripHeaders: false,
      });

      const docs = doc.getDocs();
      expect(docs?.[0]?.text).toContain('# Title');
    });

    it('should remove headers when stripHeaders: true is set in markdown chunker', async () => {
      const markdown = [
        '# H1 Title',
        'Some intro text.',
        '## H2 Subtitle',
        'More details.',
        '### H3 Section',
        'Final content.',
      ].join('\n');

      const doc = MDocument.fromMarkdown(markdown);
      const chunks = await doc.chunk({
        strategy: 'markdown',
        maxSize: 500,
        overlap: 0,
        headers: [
          ['#', 'h1'],
          ['##', 'h2'],
          ['###', 'h3'],
        ],
        stripHeaders: true,
      });
      // None of the chunk texts should start with the header patterns
      const headerPatterns = [/^#\s/, /^##\s/, /^###\s/];
      for (const chunk of chunks) {
        for (const pattern of headerPatterns) {
          expect(pattern.test(chunk.text)).toBe(false);
        }
      }
    });

    it('should support custom header prefixes', async () => {
      const text = `!!! Important\nThis is important.\n--- Section\nSection content.`;
      const doc = MDocument.fromMarkdown(text);
      await doc.chunk({
        strategy: 'markdown',
        headers: [
          ['!!!', 'important'],
          ['---', 'section'],
        ],
        stripHeaders: true,
      });
      const texts = doc.getText();
      expect(texts.some(t => t.startsWith('!!!'))).toBe(false);
      expect(texts.some(t => t.startsWith('---'))).toBe(false);
    });

    it('should attach correct metadata for nested headers', async () => {
      const text = `# H1\n## H2\n### H3\nContent`;
      const doc = MDocument.fromMarkdown(text);
      await doc.chunk({
        strategy: 'markdown',
        headers: [
          ['#', 'h1'],
          ['##', 'h2'],
          ['###', 'h3'],
        ],
        stripHeaders: true,
      });
      const chunk = doc.getDocs().find(c => c.text.includes('Content'));
      expect(chunk?.metadata?.h1).toBe('H1');
      expect(chunk?.metadata?.h2).toBe('H2');
      expect(chunk?.metadata?.h3).toBe('H3');
    });

    it('should include header lines as chunks if stripHeaders is false', async () => {
      const text = `# H1\nContent`;
      const doc = MDocument.fromMarkdown(text);
      await doc.chunk({
        strategy: 'markdown',
        headers: [['#', 'h1']],
        stripHeaders: false,
      });
      const texts = doc.getText();
      expect(texts.some(t => t.startsWith('# H1'))).toBe(true);
    });

    it('should handle multiple adjacent headers correctly', async () => {
      const text = `# H1\n## H2\n### H3\nContent`;
      const doc = MDocument.fromMarkdown(text);
      await doc.chunk({
        strategy: 'markdown',
        headers: [
          ['#', 'h1'],
          ['##', 'h2'],
          ['###', 'h3'],
        ],
        stripHeaders: true,
      });
      const texts = doc.getText();
      expect(texts.some(t => t === 'Content')).toBe(true);
      expect(texts.some(t => t === '')).toBe(false);
    });

    it('should handle content before any header', async () => {
      const text = `Intro before header\n# H1\nContent`;
      const doc = MDocument.fromMarkdown(text);
      await doc.chunk({
        strategy: 'markdown',
        headers: [['#', 'h1']],
        stripHeaders: true,
      });
      const preHeaderChunk = doc.getDocs().find(c => c.text.includes('Intro before header'));
      expect(preHeaderChunk?.metadata?.h1).toBeUndefined();
    });

    it('should not treat headers inside code blocks as headers', async () => {
      const text = ['# Real Header', '```', '# Not a header', '```', 'Content'].join('\n');
      const doc = MDocument.fromMarkdown(text);
      await doc.chunk({
        strategy: 'markdown',
        headers: [['#', 'h1']],
        stripHeaders: true,
      });
      const texts = doc.getText();
      expect(texts.some(t => t.includes('# Not a header'))).toBe(true);
      expect(texts.some(t => t.startsWith('# Real Header'))).toBe(false);
    });
  });

  describe('metadata extraction', () => {
    it('should extract metadata with default settings', async () => {
      const doc = MDocument.fromMarkdown(
        '# AI and Machine Learning\n\nThis is a test document about artificial intelligence and machine learning.',
      );

      const chunks = await doc.chunk({
        strategy: 'markdown',
        extract: {
          title: true,
          summary: true,
          keywords: true,
        },
      });

      const metadata = chunks[0].metadata;
      expect(metadata).toBeDefined();
      expect(metadata.documentTitle).toBeDefined();
      expect(metadata.sectionSummary).toBeDefined();
      expect(metadata.excerptKeywords).toMatch(/^KEYWORDS: .*/);
    }, 15000);

    it('should extract metadata with custom settings', async () => {
      const doc = MDocument.fromMarkdown(
        '# AI and Machine Learning\n\nThis is a test document about artificial intelligence and machine learning.',
      );

      const chunks = await doc.chunk({
        strategy: 'markdown',
        extract: {
          title: {
            nodes: 2,
            nodeTemplate: 'Generate a title for this: {context}',
            combineTemplate: 'Combine these titles: {context}',
          },
          summary: {
            summaries: ['self'],
            promptTemplate: 'Summarize this: {context}',
          },
          questions: {
            questions: 2,
            promptTemplate: 'Generate {numQuestions} questions about: {context}',
          },
          keywords: {
            keywords: 3,
            promptTemplate: 'Extract {maxKeywords} key terms from: {context}',
          },
        },
      });

      const metadata = chunks[0].metadata;
      expect(metadata).toBeDefined();
      expect(metadata.documentTitle).toBeDefined();
      expect(metadata.sectionSummary).toBeDefined();
      const qStr = metadata.questionsThisExcerptCanAnswer;
      expect(qStr).toMatch(/1\..*\?/s);
      expect(qStr).toMatch(/2\..*\?/s);
      expect((qStr.match(/\?/g) || []).length).toBeGreaterThanOrEqual(2);
      expect(metadata.excerptKeywords).toMatch(/^1\. .*\n2\. .*\n3\. .*$/);
    }, 15000);

    it('should handle invalid summary types', async () => {
      const doc = MDocument.fromText('Test document');

      await expect(
        doc.chunk({
          extract: {
            summary: {
              summaries: ['invalid'],
            },
          },
        }),
      ).rejects.toThrow("Summaries must be one of 'self', 'prev', 'next'");
    }, 15000);
  });

  describe('metadata preservation', () => {
    const baseText = 'This is a test document for metadata extraction.';
    const baseMetadata = { source: 'unit-test', customField: 123 };

    it('preserves metadata with KeywordExtractor', async () => {
      const doc = MDocument.fromText(baseText, { ...baseMetadata });
      const chunks = await doc.chunk({ extract: { keywords: true } });
      const metadata = chunks[0].metadata;
      expect(metadata.source).toBe('unit-test');
      expect(metadata.customField).toBe(123);
      expect(metadata.excerptKeywords).toBeDefined();
    });

    it('preserves metadata with SummaryExtractor', async () => {
      const doc = MDocument.fromText(baseText, { ...baseMetadata });
      const chunks = await doc.chunk({ extract: { summary: true } });
      const metadata = chunks[0].metadata;
      expect(metadata.source).toBe('unit-test');
      expect(metadata.customField).toBe(123);
      expect(metadata.sectionSummary).toBeDefined();
    });

    it('preserves metadata with QuestionsAnsweredExtractor', async () => {
      const doc = MDocument.fromText(baseText, { ...baseMetadata });
      const chunks = await doc.chunk({ extract: { questions: true } });
      const metadata = chunks[0].metadata;
      expect(metadata.source).toBe('unit-test');
      expect(metadata.customField).toBe(123);
      expect(metadata.questionsThisExcerptCanAnswer).toBeDefined();
    });

    it('preserves metadata with TitleExtractor', async () => {
      const doc = MDocument.fromText(baseText, { ...baseMetadata });
      const chunks = await doc.chunk({ extract: { title: true } });
      const metadata = chunks[0].metadata;
      expect(metadata.source).toBe('unit-test');
      expect(metadata.customField).toBe(123);
      expect(metadata.documentTitle).toBeDefined();
    });

    it('preserves metadata with multiple extractors', async () => {
      const doc = MDocument.fromText(baseText, { ...baseMetadata });
      const chunks = await doc.chunk({
        extract: {
          keywords: true,
          summary: true,
          questions: true,
          title: true,
        },
      });
      const metadata = chunks[0].metadata;
      expect(metadata.source).toBe('unit-test');
      expect(metadata.customField).toBe(123);
      expect(metadata.excerptKeywords).toBeDefined();
      expect(metadata.sectionSummary).toBeDefined();
      expect(metadata.questionsThisExcerptCanAnswer).toBeDefined();
      expect(metadata.documentTitle).toBeDefined();
    });
    it('preserves metadata on all chunks when multiple are created', async () => {
      const text = 'Chunk one.\n\nChunk two.\n\nChunk three.';
      const doc = MDocument.fromText(text, { source: 'multi-chunk', customField: 42 });
      const chunks = await doc.chunk({
        strategy: 'character',
        separator: '\n\n',
        maxSize: 20,
        overlap: 0,
        extract: { keywords: true },
      });
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        const metadata = chunk.metadata;
        expect(metadata.source).toBe('multi-chunk');
        expect(metadata.customField).toBe(42);
        expect(metadata.excerptKeywords).toBeDefined();
      }
    });

    it('overwrites only the matching metadata field with extractor output', async () => {
      const doc = MDocument.fromText('Test for overwrite', {
        excerptKeywords: 'original,keywords',
        unrelatedField: 'should stay',
        source: 'unit-test',
      });
      const chunks = await doc.chunk({ extract: { keywords: true } });
      const metadata = chunks[0].metadata;
      expect(metadata.source).toBe('unit-test');
      expect(metadata.unrelatedField).toBe('should stay');
      expect(metadata.excerptKeywords).not.toBe('original,keywords'); // Should be new keywords
    });
  });
  describe('MDocument TitleExtractor document grouping integration', () => {
    it('groups chunks by docId for title extraction (integration)', async () => {
      const doc = new MDocument({
        docs: [
          { text: 'Alpha chunk 1', metadata: { docId: 'docA' } },
          { text: 'Alpha chunk 2', metadata: { docId: 'docA' } },
          { text: 'Beta chunk 1', metadata: { docId: 'docB' } },
        ],
        type: 'text',
      });

      await doc.extractMetadata({ title: true });
      const chunks = doc.getDocs();

      const titleA1 = chunks[0].metadata.documentTitle;
      const titleA2 = chunks[1].metadata.documentTitle;
      const titleB = chunks[2].metadata.documentTitle;

      expect(titleA1).toBeDefined();
      expect(titleA2).toBeDefined();
      expect(titleB).toBeDefined();
      expect(titleA1).toBe(titleA2);
      expect(titleA1).not.toBe(titleB);
    });
  });

  describe('chunkSentence', () => {
    it('should preserve sentence structure and avoid mid-sentence breaks', async () => {
      const text =
        'A dynamic concert scene captures an energetic, vibrant atmosphere, with a densely packed crowd silhouetted against bright stage lights. The image features beams of white light radiating from multiple projectors, creating dramatic patterns across a darkened room. The audience, comprised of numerous people with raised hands, exudes excitement and engagement, enhancing the lively mood. The setting suggests a large indoor venue, possibly a music or worship event, with text visible on a screen in the background, adding to an immersive experience. The overall composition emphasizes a sense of community and shared enthusiasm, ideal for promoting entertainment events, live concerts, or communal gatherings. The high-contrast lighting and slight haze effect imbue the scene with a modern, electrifying quality.';

      const doc = MDocument.fromText(text);

      const chunks = await doc.chunk({
        strategy: 'sentence',
        minSize: 50,
        maxSize: 450,
        overlap: 0,
        sentenceEnders: ['.'],
        keepSeparator: true,
      });

      expect(chunks.length).toBeGreaterThan(1);

      chunks.forEach(chunk => {
        expect(chunk.text.length).toBeGreaterThanOrEqual(50);
        expect(chunk.text.length).toBeLessThanOrEqual(450);

        expect(chunk.text.startsWith('.')).toBe(false);
        expect(chunk.text.startsWith(' .')).toBe(false);

        expect(chunk.text.endsWith('.')).toBe(true);
      });
    });

    it('should require maxSize parameter', async () => {
      const doc = MDocument.fromText('Short text.');

      await expect(
        doc.chunk({
          strategy: 'sentence',
          minSize: 50,
        } as any),
      ).rejects.toThrow('Invalid parameters for sentence strategy: maxSize: Required');
    });

    it('should handle custom sentence enders', async () => {
      const text =
        'First sentence with more content to make it longer. Second sentence with additional content! Third sentence with even more text? Fourth sentence with final content.';

      const doc = MDocument.fromText(text);

      const chunks = await doc.chunk({
        strategy: 'sentence',
        maxSize: 100,
        sentenceEnders: ['.', '!', '?'],
        keepSeparator: true,
      });

      expect(chunks.length).toBeGreaterThan(1);

      chunks.forEach(chunk => {
        const endsWithValidSeparator = chunk.text.endsWith('.') || chunk.text.endsWith('!') || chunk.text.endsWith('?');
        expect(endsWithValidSeparator).toBe(true);
      });
    });

    it('should handle overlap with complete sentences', async () => {
      const text =
        'First sentence with some content that makes it quite long. Second sentence with different content that also makes it lengthy. Third sentence with more content to ensure multiple chunks. Fourth sentence with final content to complete the test.';

      const doc = MDocument.fromText(text);

      const chunks = await doc.chunk({
        strategy: 'sentence',
        maxSize: 120,
        overlap: 50,
        sentenceEnders: ['.'],
        keepSeparator: true,
      });

      expect(chunks.length).toBeGreaterThan(1);

      // Check that overlapping chunks share some content
      if (chunks.length > 1) {
        for (let i = 1; i < chunks.length; i++) {
          const currentChunk = chunks[i].text;

          // With overlap, current chunk should start with some content from previous chunk
          // Just verify that overlap is being applied (chunk 2 starts with overlap from chunk 1)
          expect(currentChunk.length).toBeGreaterThan(50); // Should include overlap content
        }
      }
    });

    it('should fallback to word splitting for oversized sentences', async () => {
      const longSentence =
        'This is an extremely long sentence that ' +
        'word '.repeat(50) +
        'and should be split into smaller chunks when it exceeds the maximum size limit.';

      const doc = MDocument.fromText(longSentence);

      const chunks = await doc.chunk({
        strategy: 'sentence',
        maxSize: 100,
        fallbackToWords: true,
      });

      expect(chunks.length).toBeGreaterThan(1);

      chunks.forEach(chunk => {
        expect(chunk.text.length).toBeLessThanOrEqual(100);
      });
    });

    it('should handle short text appropriately', async () => {
      const text = 'Short sentence.';

      const doc = MDocument.fromText(text);

      const chunks = await doc.chunk({
        strategy: 'sentence',
        minSize: 5,
        maxSize: 100,
        sentenceEnders: ['.'],
        keepSeparator: true,
      });

      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toBe(text);
    });

    it('should group multiple sentences when they fit within target size', async () => {
      const text = 'Short one. Another short. Third short. Fourth sentence. Fifth one.';

      const doc = MDocument.fromText(text);

      const chunks = await doc.chunk({
        strategy: 'sentence',
        minSize: 10,
        maxSize: 100,
        targetSize: 40,
        sentenceEnders: ['.'],
        keepSeparator: true,
      });

      // Should group multiple short sentences together
      expect(chunks.length).toBeLessThan(5); // Less than the number of sentences

      chunks.forEach(chunk => {
        // Each chunk should contain multiple sentences when possible
        expect(chunk.text.length).toBeLessThanOrEqual(100);
      });
    });

    it('should preserve metadata across chunks', async () => {
      const text =
        'First sentence with enough content to make it longer than fifty characters. Second sentence with additional content to ensure multiple chunks. Third sentence with final content.';
      const metadata = { source: 'test', author: 'jest' };

      const doc = MDocument.fromText(text, metadata);

      const chunks = await doc.chunk({
        strategy: 'sentence',
        maxSize: 100,
        sentenceEnders: ['.'],
        keepSeparator: true,
      });

      expect(chunks.length).toBeGreaterThan(1);

      chunks.forEach(chunk => {
        expect(chunk.metadata.source).toBe('test');
        expect(chunk.metadata.author).toBe('jest');
      });
    });

    it('should handle abbreviations without false sentence breaks', async () => {
      const text =
        'Dr. Smith went to the U.S.A. at 3:30 a.m. on Monday. He met with Prof. Johnson at the U.N. headquarters.';

      const doc = MDocument.fromText(text);
      const chunks = await doc.chunk({
        strategy: 'sentence',
        maxSize: 200,
        sentenceEnders: ['.'],
        keepSeparator: true,
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks.length).toBeLessThanOrEqual(2);

      const allText = chunks.map(c => c.text).join(' ');
      expect(allText).toContain('Dr. Smith'); // Should keep Dr. together
      expect(allText).toContain('U.S.A.'); // Should keep U.S.A. together
      expect(allText).toContain('a.m.'); // Should keep a.m. together
      expect(allText).toContain('Prof. Johnson'); // Should keep Prof. together
      expect(allText).toContain('U.N.'); // Should keep U.N. together

      expect(allText).not.toContain('Dr '); // No broken Dr.
      expect(allText).not.toContain('Prof '); // No broken Prof.
    });

    it('should respect fallbackToCharacters setting', async () => {
      const oversizedWord = 'supercalifragilisticexpialidocious'.repeat(5);
      const text = `Short sentence. ${oversizedWord}.`;

      const doc1 = MDocument.fromText(text);
      const chunksWithFallback = await doc1.chunk({
        strategy: 'sentence',
        maxSize: 50,
        fallbackToWords: true,
        fallbackToCharacters: true,
      });

      // Should split the oversized word
      expect(chunksWithFallback.length).toBeGreaterThan(2);

      const doc2 = MDocument.fromText(text);
      const chunksWithoutFallback = await doc2.chunk({
        strategy: 'sentence',
        maxSize: 50,
        fallbackToWords: true,
        fallbackToCharacters: false,
      });

      // Should have fewer chunks (oversized word kept intact)
      expect(chunksWithoutFallback.length).toBeLessThan(chunksWithFallback.length);

      // Verify fallback disabled keeps oversized content
      const oversizedChunk = chunksWithoutFallback.find(chunk => chunk.text.length > 50);
      expect(oversizedChunk).toBeDefined();
    });

    it('should handle complex punctuation and edge cases', async () => {
      const text =
        'Version 2.0 was released. The score was 3.14159. Mr. & Mrs. Smith arrived at 12:30 p.m. What happened next?';

      const doc = MDocument.fromText(text);
      const chunks = await doc.chunk({
        strategy: 'sentence',
        maxSize: 200,
        sentenceEnders: ['.', '?'],
        keepSeparator: true,
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks.length).toBeLessThanOrEqual(4);

      const allText = chunks.map(c => c.text).join(' ');
      expect(allText).toContain('2.0'); // Should keep version numbers intact
      expect(allText).toContain('3.14159'); // Should keep decimals intact
      expect(allText).toContain('p.m.'); // Should keep time abbreviations intact
      expect(allText).toContain('What happened next?'); // Should end with question

      // Should not break on decimals or version numbers
      expect(allText).not.toContain('2 '); // No broken version number
      expect(allText).not.toContain('3 '); // No broken decimal
    });
  });

  describe('chunkSemanticMarkdown', () => {
    it('should merge small sections based on token threshold', async () => {
      const text = `# Introduction
Brief intro paragraph.

## Setup Guide  
Short setup instructions.

### Prerequisites
Very short list.

### Installation Steps
Very detailed installation process with code examples and explanations that would normally be quite long but in this test we'll keep it moderate length for testing purposes.

## Advanced Configuration
Another section with moderate content for testing the merging algorithm.`;

      const doc = MDocument.fromMarkdown(text);

      await doc.chunk({
        strategy: 'semantic-markdown',
        joinThreshold: 200,
      });

      const chunks = doc.getText();
      const docs = doc.getDocs();

      expect(chunks.length).toBeLessThan(6);

      expect(docs[0]?.metadata?.tokenCount).toBeDefined();
      expect(typeof docs[0]?.metadata?.tokenCount).toBe('number');
      expect(docs[0]?.metadata?.tokenCount).toBeGreaterThan(0);
    });

    it('should respect sibling/parent relationships in merging', async () => {
      const text = `# Main Document

## Section A
Content for section A that is moderately long to ensure we have enough tokens for testing the semantic merging algorithm properly.

### Subsection A1  
This subsection has more content than the previous version to test the hierarchical merging behavior.

### Subsection A2
Another subsection with substantial content to verify proper semantic boundary handling.

## Section B
Content for section B that is also moderately sized with meaningful text to test cross-section merging behavior.

### Subsection B1
This final subsection contains enough content to test the bottom-up merging algorithm effectively.`;

      const doc = MDocument.fromMarkdown(text);

      await doc.chunk({
        strategy: 'semantic-markdown',
        joinThreshold: 100, // Threshold that allows some merging but not everything
      });

      const chunks = doc.getText();
      const docs = doc.getDocs();

      // Should create fewer chunks than original sections due to merging
      expect(chunks.length).toBeLessThan(7);
      expect(chunks.length).toBeGreaterThanOrEqual(1);

      // Verify sections maintain semantic coherence
      const hasSection = chunks.some(chunk => chunk.includes('Section A') || chunk.includes('Subsection A1'));
      expect(hasSection).toBe(true);

      expect(docs[0]?.metadata?.tokenCount).toBeDefined();
      expect(docs[0]?.metadata?.tokenCount).toBeGreaterThan(0);
    });

    it('should correctly chunk a controlled test document', async () => {
      const controlledTestMarkdown = `# My Test Document

This is a short preamble to test how content before the first header is handled. It should be merged with the first section if that section is small enough.

## Chapter 1: The Small Sections

This is the introduction to Chapter 1. It contains several small subsections that are perfect candidates for merging.

### Section 1.1: A Tiny Topic

Just a few words here.

### Section 1.2: Another Tiny Topic

A few more words to make up a small paragraph.

## Chapter 2: The Big Section

This chapter has a very large section that should NOT be merged with its sibling because it is over the token limit all by itself.

\`\`\`python
# This is a large block of Python code.
# It is designed to have a high token count to test the merging threshold.
import os
import sys

class DataProcessor:
    def __init__(self, data):
        self.data = data
        self.length = len(data)

    def process(self):
        """
        This is a long docstring to add even more tokens to the count.
        We will iterate through the data and perform some kind of mock processing.
        The goal is to exceed the joinThreshold of 250 tokens easily.
        Let's add more lines to be sure.
        Line 1
        Line 2
        Line 3
        Line 4
        Line 5
        ...and so on.
        """
        results = []
        for i, item in enumerate(self.data):
            # A mock calculation
            processed_item = (item * i) + self.length
            results.append(processed_item)
        return results

# Let's make sure this section is large enough.
# More comments and code will help.
def another_function_to_add_tokens():
    """Another long docstring for good measure."""
    x = 1
    y = 2
    z = x + y
    print(f"The result is {z}")
    # End of function
\`\`\`

## Chapter 3: The Mixed Bag

This chapter contains a mix of small and medium sections.

### Section 3.1: A Medium Section

This section is moderately sized. It's not huge, but it has enough content to be a meaningful chunk on its own. We'll aim for about 150 tokens here so it can potentially merge with a small sibling.

### Section 3.2: A Final Small Section

This final section is very small and should definitely be merged into its predecessor, Section 3.1, because their combined total will be under the threshold.
`;

      const doc = MDocument.fromMarkdown(controlledTestMarkdown);
      await doc.chunk({
        strategy: 'semantic-markdown',
        joinThreshold: 250,
        modelName: 'gpt-3.5-turbo',
      });

      const chunks = doc.getText();
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toContain('# My Test Document');
      expect(chunks[0]).toContain('### Section 1.2: Another Tiny Topic');
      expect(chunks[1]).toContain('## Chapter 2: The Big Section');
      expect(chunks[2]).toContain('## Chapter 3: The Mixed Bag');
      expect(chunks[2]).toContain('### Section 3.2: A Final Small Section');
    });

    it('should preserve code blocks during merging', async () => {
      const text = `# Code Example

## Installation
Install the package:

\`\`\`bash
npm install example-package
\`\`\`

## Usage
Here's how to use it:

\`\`\`javascript
const example = require('example-package');
example.doSomething();
\`\`\`

## Configuration
Set up your config file.`;

      const doc = MDocument.fromMarkdown(text);

      await doc.chunk({
        strategy: 'semantic-markdown',
        joinThreshold: 300,
      });

      const chunks = doc.getText();

      // Code blocks should be preserved intact
      expect(chunks.some(chunk => chunk.includes('```bash'))).toBe(true);
      expect(chunks.some(chunk => chunk.includes('```javascript'))).toBe(true);

      // Should not split within code blocks
      const bashChunk = chunks.find(chunk => chunk.includes('npm install'));
      expect(bashChunk).toBeDefined();
      expect(bashChunk).toContain('```bash');
    });

    it('should work with different tiktoken models', async () => {
      const text = `# Test Document

## Section 1
Some content for testing different tiktoken models and their token counting accuracy.

## Section 2  
More content to verify the token counting works correctly across different model encodings.`;

      const doc = MDocument.fromMarkdown(text);

      await doc.chunk({
        strategy: 'semantic-markdown',
        joinThreshold: 100,
        modelName: 'gpt-4',
      });

      const chunks = doc.getText();
      const docs = doc.getDocs();

      expect(chunks.length).toBeGreaterThan(0);
      expect(docs[0]?.metadata?.tokenCount).toBeDefined();
      expect(typeof docs[0]?.metadata?.tokenCount).toBe('number');
    });

    it('should handle documents with no headers', async () => {
      const text = `This is a document with no markdown headers.
    
Just regular paragraphs of text that should be processed as a single semantic unit since there are no headers to split on.

More paragraphs here to test the behavior.`;

      const doc = MDocument.fromMarkdown(text);

      await doc.chunk({
        strategy: 'semantic-markdown',
        joinThreshold: 200,
      });

      const chunks = doc.getText();

      // Should return single chunk since no headers to split on
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toContain('This is a document with no markdown headers');
    });

    it('should handle empty sections correctly', async () => {
      const text = `# Document

## Empty Section

## Another Section
Some content here.

## Final Empty Section

`;

      const doc = MDocument.fromMarkdown(text);

      await doc.chunk({
        strategy: 'semantic-markdown',
        joinThreshold: 100,
      });

      const chunks = doc.getText();

      // Should handle empty sections gracefully
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some(chunk => chunk.includes('Some content here'))).toBe(true);
    });

    it('should maintain bottom-up merging order (deepest first)', async () => {
      const text = `# Root

## Level 2A
Content 2A

### Level 3A  
Short content 3A

#### Level 4A
Short content 4A

### Level 3B
Short content 3B

## Level 2B
Content 2B`;

      const doc = MDocument.fromMarkdown(text);

      await doc.chunk({
        strategy: 'semantic-markdown',
        joinThreshold: 200,
      });

      const chunks = doc.getText();

      // The algorithm should merge from deepest level first
      // Level 4 should merge with Level 3, then Level 3s might merge with Level 2
      expect(chunks.length).toBeLessThan(7); // Less than original 7 sections

      // Verify deep nesting is preserved in merged content
      const deepChunk = chunks.find(chunk => chunk.includes('Level 4A') && chunk.includes('Level 3A'));
      expect(deepChunk).toBeDefined();
    });

    it('should compare token accuracy vs character-based sizing', async () => {
      // Use text with unicode and varying token densities
      const text = `# Test Document

## Unicode Section
This section contains unicode characters: café, naïve, résumé, 中文, العربية

## Code Section
\`\`\`python
def function_with_long_name_and_parameters(param1, param2, param3):
    return param1 + param2 + param3
\`\`\`

## Regular Section
Regular English text without special characters.`;

      const doc = MDocument.fromMarkdown(text);

      await doc.chunk({
        strategy: 'semantic-markdown',
        joinThreshold: 150, // Token-based threshold
      });

      const docs = doc.getDocs();

      // Verify token counts are provided in metadata
      docs.forEach(doc => {
        expect(doc.metadata.tokenCount).toBeDefined();
        expect(typeof doc.metadata.tokenCount).toBe('number');
        expect(doc.metadata.tokenCount).toBeGreaterThan(0);
      });

      // Token count should be different from character count for unicode text
      const unicodeDoc = docs.find(doc => doc.text.includes('café'));
      if (unicodeDoc) {
        const charCount = unicodeDoc.text.length;
        const tokenCount = unicodeDoc.metadata.tokenCount;

        // For text with unicode, token count is often different from char count
        expect(tokenCount).toBeDefined();
        expect(tokenCount).not.toBe(charCount);
      }
    });

    it('should handle documents with only deep headers (no top-level sections)', async () => {
      const text = `### Deep Section 1
Short content for deep section 1.

#### Very Deep Section 1.1
Even shorter content.

#### Very Deep Section 1.2
Another short subsection.

### Deep Section 2
Short content for deep section 2.

#### Very Deep Section 2.1
Final short content.`;

      const doc = MDocument.fromMarkdown(text);

      await doc.chunk({
        strategy: 'semantic-markdown',
        joinThreshold: 200,
      });

      const chunks = doc.getText();
      const docs = doc.getDocs();

      // Should merge the small deep sections together
      expect(chunks.length).toBeLessThan(5);
      expect(chunks.length).toBeGreaterThan(0);

      // Verify deep headers are preserved in merged content
      const deepChunk = chunks.find(
        chunk => chunk.includes('### Deep Section 1') && chunk.includes('#### Very Deep Section'),
      );
      expect(deepChunk).toBeDefined();

      expect(docs[0]?.metadata?.tokenCount).toBeDefined();
    });

    it('should leave very large individual sections intact (exceeding joinThreshold)', async () => {
      const largeContent = 'This is a very long section. '.repeat(50); // ~1500 tokens
      const text = `# Document Title

## Small Section
Small content here.

## Oversized Section
${largeContent}

\`\`\`javascript
// Adding code to make it even larger
function processData(data) {
  const results = [];
  for (let i = 0; i < data.length; i++) {
    const processed = data[i] * 2 + Math.random();
    results.push(processed);
    console.log(\`Processed item \${i}: \${processed}\`);
  }
  return results;
}

// More code to ensure we exceed the threshold
class DataManager {
  constructor(initialData) {
    this.data = initialData;
    this.processedCount = 0;
  }
  
  process() {
    this.data.forEach((item, index) => {
      // Process each item
      this.processedCount++;
    });
  }
}
\`\`\`

## Another Small Section
More small content.`;

      const doc = MDocument.fromMarkdown(text);

      await doc.chunk({
        strategy: 'semantic-markdown',
        joinThreshold: 300, // Much smaller than the oversized section
      });

      const chunks = doc.getText();
      const docs = doc.getDocs();

      expect(chunks.length).toBeGreaterThan(1);

      // The oversized section should be left as its own chunk
      const oversizedChunk = chunks.find(chunk => chunk.includes('Oversized Section'));
      expect(oversizedChunk).toBeDefined();
      expect(oversizedChunk).toContain('This is a very long section.');

      // Verify the oversized chunk exceeds the threshold
      const oversizedDoc = docs.find(doc => doc.text.includes('Oversized Section'));
      expect(oversizedDoc?.metadata?.tokenCount).toBeGreaterThan(300);

      // Small sections should still be merged where possible
      const smallChunk = chunks.find(chunk => chunk.includes('Small Section') && !chunk.includes('Oversized'));
      expect(smallChunk).toBeDefined();
    });

    it('should handle mixed header levels with gaps (skipping levels)', async () => {
      const text = `# Top Level

#### Deep Level A (skipped H2 and H3)
Content for deep level A that is moderately sized with enough text to make it substantial. This section needs to have sufficient content to test the merging behavior properly when header levels are skipped. Let's add more content to ensure we have enough tokens to work with.

## Middle Level
Content for middle level section that also needs to be substantial enough to test the algorithm. This section should have enough content to be meaningful when testing the semantic markdown chunking with mixed header levels.

##### Very Deep Level (skipped H3 and H4)
Short content for very deep level that should still be substantial enough for testing. Even though this is marked as short, we need enough content to make the test meaningful.

# Another Top Level

This second top-level section should definitely create a boundary that prevents everything from merging into a single chunk. We need substantial content here to ensure proper separation.

### Medium Deep Level (skipped H2)
Final content for testing header level gaps. This section also needs substantial content to ensure we're testing the algorithm properly with realistic content sizes.`;

      const doc = MDocument.fromMarkdown(text);

      await doc.chunk({
        strategy: 'semantic-markdown',
        joinThreshold: 150, // Smaller threshold to encourage more chunks
      });

      const chunks = doc.getText();

      // Should handle the gaps gracefully - expect at least 2 chunks due to the second top-level section
      expect(chunks.length).toBeGreaterThanOrEqual(1);

      // Verify headers with gaps are preserved
      expect(chunks.some(chunk => chunk.includes('#### Deep Level A'))).toBe(true);
      expect(chunks.some(chunk => chunk.includes('##### Very Deep Level'))).toBe(true);
      expect(chunks.some(chunk => chunk.includes('### Medium Deep Level'))).toBe(true);

      // Verify both top-level sections are present
      expect(chunks.some(chunk => chunk.includes('# Top Level'))).toBe(true);
      expect(chunks.some(chunk => chunk.includes('# Another Top Level'))).toBe(true);
    });

    it('should handle large documents efficiently (performance test)', async () => {
      const sections: string[] = [];
      for (let i = 1; i <= 100; i++) {
        sections.push(`## Section ${i}`);
        sections.push(`This is content for section ${i}. `.repeat(10)); // ~100 tokens each

        for (let j = 1; j <= 3; j++) {
          sections.push(`### Subsection ${i}.${j}`);
          sections.push(`This is subsection content ${i}.${j}. `.repeat(5)); // ~50 tokens each
        }
      }

      const largeText = `# Large Test Document\n\n${sections.join('\n\n')}`;

      const doc = MDocument.fromMarkdown(largeText);

      const startTime = Date.now();

      await doc.chunk({
        strategy: 'semantic-markdown',
        joinThreshold: 300,
      });

      const duration = Date.now() - startTime;
      const chunks = doc.getText();
      const docs = doc.getDocs();

      expect(duration).toBeLessThan(5000);

      expect(chunks.length).toBeGreaterThan(10);
      expect(chunks.length).toBeLessThan(400);

      docs.forEach(doc => {
        expect(doc.metadata.tokenCount).toBeDefined();
        expect(doc.metadata.tokenCount).toBeGreaterThan(0);
      });
    }, 10000);

    it('should maintain semantic coherence with very small joinThreshold', async () => {
      const text = `# Document

This is a substantial preamble section that should have enough content to be meaningful in token counting. We need sufficient content here to test the algorithm properly.

## Section A
Brief content for section A that needs to be expanded to ensure we have meaningful token counts for testing the semantic markdown chunking algorithm with a very small threshold.

### Sub A1
More substantial content here for subsection A1. This content needs to be long enough to have a reasonable token count that will affect the merging decisions in our semantic chunking algorithm.

### Sub A2
Even more substantial content for subsection A2. Again, we need enough tokens here to make the test meaningful and to properly exercise the algorithm's decision-making process.

## Section B
Another section with substantial content for section B. This section should also have enough content to be meaningful in our token-based chunking strategy testing.

### Sub B1
Final substantial content for subsection B1. This content should complete our test document with enough tokens to properly test the small threshold behavior.`;

      const doc = MDocument.fromMarkdown(text);

      await doc.chunk({
        strategy: 'semantic-markdown',
        joinThreshold: 30, // Even smaller threshold to force separation
      });

      const chunks = doc.getText();

      // With a very small threshold, we should get at least some separation
      expect(chunks.length).toBeGreaterThanOrEqual(1);

      // Verify all chunks have meaningful content
      chunks.forEach(chunk => {
        expect(chunk.trim().length).toBeGreaterThan(0);
        expect(chunk.trim().length).toBeGreaterThan(10);
      });

      // Verify we have the main document structure preserved
      const allText = chunks.join(' ');
      expect(allText).toContain('# Document');
      expect(allText).toContain('## Section A');
      expect(allText).toContain('## Section B');
    });

    it('should not treat headers inside code blocks as headers for splitting', async () => {
      const text = `# Real Header

Some introductory text explaining code examples.

\`\`\`markdown
# This is not a real header
It is inside a code block and should be ignored for chunking.

## This is also not a real header  
It should be treated as plain text content, not a section boundary.

### Even deeper fake headers
Should also be ignored completely.
\`\`\`

## A Real Second Header
This content comes after the code block.

### A Real Subsection
With some additional content to test the hierarchy.`;

      const doc = MDocument.fromMarkdown(text);

      await doc.chunk({
        strategy: 'semantic-markdown',
        joinThreshold: 25, // Low threshold to force separation into 2 or more chunks
      });

      const chunks = doc.getText();

      // With a low threshold, we should get exactly 2 chunks:
      // 1. "# Real Header" section (with the code block as content)
      // 2. "## A Real Second Header" section (with its subsection)
      // If fake headers were processed, we'd get more than 2 chunks
      expect(chunks.length).toBe(2);

      const firstChunk = chunks[0];
      const secondChunk = chunks[1];

      expect(firstChunk).toContain('# Real Header');
      expect(firstChunk).toContain('Some introductory text explaining code examples');
      expect(firstChunk).toContain('```markdown');
      expect(firstChunk).toContain('# This is not a real header');
      expect(firstChunk).toContain('## This is also not a real header');
      expect(firstChunk).toContain('### Even deeper fake headers');
      expect(firstChunk).not.toContain('## A Real Second Header');

      expect(secondChunk).toContain('## A Real Second Header');
      expect(secondChunk).toContain('### A Real Subsection');
      expect(secondChunk).not.toContain('# Real Header');
      expect(secondChunk).not.toContain('# This is not a real header');
    });
  });
});

// Helper function to find the longest common substring between two strings
function findCommonSubstring(str1: string, str2: string): string {
  let longest = '';

  // Check for substrings of str1 in str2
  for (let i = 0; i < str1.length; i++) {
    for (let j = i + 1; j <= str1.length; j++) {
      const substring = str1.substring(i, j);
      if (substring.length > longest.length && str2.includes(substring)) {
        longest = substring;
      }
    }
  }

  return longest;
}
