import { createOpenAI } from '@ai-sdk/openai';
import { embedMany } from 'ai';
import { describe, it, expect } from 'vitest';

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
        size: 1500,
        overlap: 0,
        separator: `\n`,
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

      console.log(embeddings);
      expect(embeddings).toBeDefined();
    });
  });

  describe('chunkCharacter', () => {
    it('should split text on simple separator', async () => {
      const text = 'Hello world\n\nHow are you\n\nI am fine';

      const doc = MDocument.fromText(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'character',
        separator: '\n\n',
        isSeparatorRegex: false,
        size: 50,
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
        size: 50,
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
        size: 50,
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
          size: 50,
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
          size: 50,
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
          size: 50,
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
          size: 50,
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
          size: 50,
          overlap: 5,
          keepSeparator: 'start',
        });

        const chunks = doc.getText();

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.join('')).toBe(text);
      });
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
        size: 50,
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
        size: 50,
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
          size: 50,
          overlap: 5,
          language: 'invalid-language' as any,
        }),
      ).rejects.toThrow();
    });

    it('should maintain context with overlap', async () => {
      const text = 'This is a test.\nIt has multiple lines.\nEach line should be handled properly.';
      const doc = MDocument.fromText(text, { meta: 'data' });

      await doc.chunk();

      for (let i = 1; i < doc.getDocs().length; i++) {
        const prevChunk = doc.getDocs()[i - 1]?.text;
        const currentChunk = doc.getDocs()?.[i]?.text;

        const hasOverlap = prevChunk?.split(' ').some(word => currentChunk?.includes(word));

        expect(hasOverlap).toBe(true);
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
  });

  describe('chunkToken', () => {
    it('should handle different encodings', async () => {
      const text = 'This is a test text for different encodings.';
      const doc = MDocument.fromText(text, { meta: 'data' });

      await doc.chunk({
        strategy: 'token',
        encodingName: 'cl100k_base',
        size: 10,
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
        size: 10,
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
        size: 10,
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
      it('should throw error for invalid chunk size and overlap', async () => {
        const text = '  This has whitespace   ';
        const doc = MDocument.fromText(text, { meta: 'data' });

        await expect(
          doc.chunk({
            strategy: 'token',
            size: 100,
            overlap: 150, // overlap larger than chunk size
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
            size: 100,
            overlap: 150, // overlap larger than chunk size
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
        size: 100,
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
        size: 100,
        overlap: 10,
      });

      const chunks = doc.getText();
      expect(chunks.some(chunk => chunk.includes('```javascript'))).toBe(true);
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
  });
});
