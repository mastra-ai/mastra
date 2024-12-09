import { TiktokenEncoding } from '@dqbd/tiktoken';

import {
  TokenTextSplitter,
  Document,
  CharacterTextSplitter,
  RecursiveCharacterTextSplitter,
  Language,
} from './transformer';

describe('TokenTextSplitter', () => {
  let splitter: TokenTextSplitter;

  beforeEach(() => {
    splitter = TokenTextSplitter.fromTikToken('cl100k_base' as TiktokenEncoding, undefined, {
      chunkSize: 10,
      chunkOverlap: 2,
    });
  });

  afterEach(() => {
    splitter.dispose();
  });

  describe('splitText', () => {
    it('should split text into chunks of appropriate size', () => {
      const text = 'This is a test of the text splitting system.';
      const chunks = splitter.splitText(text);

      // Each chunk should be approximately the specified size in tokens
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(text.length);
      });

      // Should be able to reconstruct original text (minus some whitespace)
      const reconstructed = chunks.join(' ').trim();
      expect(reconstructed).toBe(text);
    });

    it('should handle empty text', () => {
      const chunks = splitter.splitText('');
      expect(chunks).toHaveLength(0);
    });

    it('should handle text shorter than chunk size', () => {
      const text = 'Short text';
      const chunks = splitter.splitText(text);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it('should maintain overlap between chunks', () => {
      const text = 'This is a longer piece of text that should be split into multiple chunks with overlap.';
      const chunks = splitter.splitText(text);

      // Skip test if we don't have multiple chunks
      if (chunks.length <= 1) {
        return;
      }

      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1];
        const currentChunk = chunks[i];

        // Find some overlapping content
        let hasOverlap = false;
        // Check if we have both chunks before processing
        if (prevChunk && currentChunk) {
          const words = prevChunk.split(' ');
          const lastWords = words.slice(-2).join(' '); // Check last two words
          if (currentChunk.includes(lastWords)) {
            hasOverlap = true;
          }
        }

        expect(hasOverlap).toBe(true);
      }
    });
  });

  describe('createDocuments', () => {
    it('should create documents with metadata', async () => {
      const texts = ['This is the first document.', 'This is the second document.'];
      const metadatas = [{ source: 'doc1' }, { source: 'doc2' }];

      const documents = splitter.createDocuments(texts, metadatas);

      // Group documents by their source metadata
      const doc1Chunks = documents.filter(doc => doc.metadata.source === 'doc1');
      const doc2Chunks = documents.filter(doc => doc.metadata.source === 'doc2');

      // Check that we have chunks for each document
      expect(doc1Chunks.length).toBeGreaterThan(0);
      expect(doc2Chunks.length).toBeGreaterThan(0);

      // Verify each chunk has correct metadata
      doc1Chunks.forEach(doc => {
        expect(doc.metadata.source).toBe('doc1');
      });
      doc2Chunks.forEach(doc => {
        expect(doc.metadata.source).toBe('doc2');
      });

      // Verify the chunks can reconstruct original text
      const reconstructed1 = doc1Chunks
        .map(d => d.pageContent)
        .join(' ')
        .trim();
      const reconstructed2 = doc2Chunks
        .map(d => d.pageContent)
        .join(' ')
        .trim();

      expect(reconstructed1).toBe(texts[0]);
      expect(reconstructed2).toBe(texts[1]);
    });
    it('should handle documents with start index', () => {
      const splitterWithIndex = TokenTextSplitter.fromTikToken('gpt2', undefined, {
        chunkSize: 10,
        chunkOverlap: 2,
      });
      splitterWithIndex.setAddStartIndex(true); // Using the new setter method

      const text = ['This is a test document with multiple sentences.'];
      const docs = splitterWithIndex.createDocuments(text);

      docs.forEach(doc => {
        expect(doc.metadata).toHaveProperty('startIndex');
        expect(typeof doc.metadata.startIndex).toBe('number');
        expect(doc.metadata.startIndex).toBeGreaterThanOrEqual(0);

        // Verify that the chunk actually starts at the specified index
        const sourceText = text[0];
        if (sourceText) {
          const actualText = sourceText.substring(doc.metadata.startIndex);
          expect(actualText.startsWith(doc.pageContent.trim())).toBe(true);
        }
      });

      splitterWithIndex.dispose();
    });
  });

  describe('transformDocuments', () => {
    it('should transform documents while preserving metadata', () => {
      const initialDocuments: Document[] = [
        {
          pageContent: 'This is a long document that needs to be split into multiple chunks.',
          metadata: { source: 'test1', page: 1 },
        },
        {
          pageContent: 'This is another document that also needs to be split properly.',
          metadata: { source: 'test2', page: 2 },
        },
      ];

      const transformedDocs = splitter.transformDocuments(initialDocuments);

      expect(transformedDocs.length).toBeGreaterThan(initialDocuments.length);

      transformedDocs.forEach((doc, i) => {
        const originalDocIndex = Math.floor(i / 2);
        const originalDoc = initialDocuments[originalDocIndex];
        if (originalDoc) {
          expect(doc.metadata).toEqual(originalDoc.metadata);
        }
      });
    });
  });

  describe('Error cases', () => {
    it('should throw error for invalid chunk size and overlap', () => {
      expect(() => {
        new TokenTextSplitter('gpt2', undefined, new Set(), 'all', {
          chunkSize: 100,
          chunkOverlap: 150, // overlap larger than chunk size
        });
      }).toThrow();
    });

    it('should handle invalid encoding name', () => {
      expect(() => {
        TokenTextSplitter.fromTikToken('invalid-encoding' as any);
      }).toThrow();
    });
  });

  describe('Advanced features', () => {
    it('should handle different encodings', () => {
      const gpt3Splitter = TokenTextSplitter.fromTikToken(undefined, 'gpt-3.5-turbo');
      const text = 'This is a test text for different encodings.';
      const chunks = gpt3Splitter.splitText(text);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join(' ').trim()).toBe(text);

      gpt3Splitter.dispose();
    });

    it('should handle special tokens correctly', () => {
      const splitterWithSpecial = TokenTextSplitter.fromTikToken('gpt2', undefined, {
        allowedSpecial: new Set(['<|endoftext|>']),
        disallowedSpecial: new Set(),
      });

      const text = 'Test text <|endoftext|> more text';
      const chunks = splitterWithSpecial.splitText(text);

      expect(chunks.join(' ').includes('<|endoftext|>')).toBe(true);

      splitterWithSpecial.dispose();
    });

    it('should strip whitespace when configured', () => {
      const splitterWithStrip = TokenTextSplitter.fromTikToken('gpt2', undefined, {
        chunkSize: 10,
        chunkOverlap: 2,
      });

      const text = '  This has whitespace   ';
      const chunks = splitterWithStrip.splitText(text);

      chunks.forEach(chunk => {
        expect(chunk).not.toMatch(/^\s+|\s+$/);
      });

      splitterWithStrip.dispose();
    });
  });
});

describe('CharacterTextSplitter', () => {
  let splitter: CharacterTextSplitter;

  beforeEach(() => {
    splitter = new CharacterTextSplitter('\n\n', false, {
      chunkSize: 50,
      chunkOverlap: 5,
    });
  });

  it('should split text on simple separator', () => {
    const text = 'Hello world\n\nHow are you\n\nI am fine';
    const chunks = splitter.splitText(text);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toBe('Hello world');
    expect(chunks[1]).toBe('How are you');
    expect(chunks[2]).toBe('I am fine');
  });

  it('should handle regex separator', () => {
    const regexSplitter = new CharacterTextSplitter('\\s+', true, {
      chunkSize: 50,
      chunkOverlap: 5,
    });

    const text = 'Hello   world\n\nHow    are    you';
    const chunks = regexSplitter.splitText(text);

    expect(chunks.join(' ')).toBe('Hello world How are you');
  });

  it('should keep separator when specified', () => {
    const splitterWithSeparator = new CharacterTextSplitter('\n\n', false, {
      chunkSize: 50,
      chunkOverlap: 5,
      keepSeparator: 'end',
    });

    const text = 'Hello\n\nWorld';
    const chunks = splitterWithSeparator.splitText(text);

    expect(chunks[0]).toBe('Hello\n\n');
    expect(chunks[1]).toBe('World');
  });

  describe('separator handling', () => {
    it('should keep separator at end when specified', () => {
      const splitterWithSeparator = new CharacterTextSplitter('\n\n', false, {
        chunkSize: 50,
        chunkOverlap: 5,
        keepSeparator: 'end',
      });

      const text = 'Hello\n\nWorld';
      const chunks = splitterWithSeparator.splitText(text);

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toBe('Hello\n\n');
      expect(chunks[1]).toBe('World');
    });

    it('should keep separator at start when specified', () => {
      const splitterWithSeparator = new CharacterTextSplitter('\n\n', false, {
        chunkSize: 50,
        chunkOverlap: 5,
        keepSeparator: 'start',
      });

      const text = 'Hello\n\nWorld\n\nTest';
      const chunks = splitterWithSeparator.splitText(text);

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toBe('Hello');
      expect(chunks[1]).toBe('\n\nWorld');
      expect(chunks[2]).toBe('\n\nTest');
    });

    it('should handle multiple consecutive separators', () => {
      const splitterWithSeparator = new CharacterTextSplitter('\n\n', false, {
        chunkSize: 50,
        chunkOverlap: 5,
        keepSeparator: 'end',
      });

      const text = 'Hello\n\n\n\nWorld';
      const chunks = splitterWithSeparator.splitText(text);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toBe(text);
    });

    it('should handle text ending with separator', () => {
      const splitterWithSeparator = new CharacterTextSplitter('\n\n', false, {
        chunkSize: 50,
        chunkOverlap: 5,
        keepSeparator: 'end',
      });

      const text = 'Hello\n\nWorld\n\n';
      const chunks = splitterWithSeparator.splitText(text);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toBe(text);
    });

    it('should handle text starting with separator', () => {
      const splitterWithSeparator = new CharacterTextSplitter('\n\n', false, {
        chunkSize: 50,
        chunkOverlap: 5,
        keepSeparator: 'start',
      });

      const text = '\n\nHello\n\nWorld';
      const chunks = splitterWithSeparator.splitText(text);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toBe(text);
    });
  });
});

describe('RecursiveCharacterTextSplitter', () => {
  let splitter: RecursiveCharacterTextSplitter;

  beforeEach(() => {
    splitter = new RecursiveCharacterTextSplitter(['\n\n', '\n', ' ', ''], false, {
      chunkSize: 50,
      chunkOverlap: 5,
    });
  });

  it('should recursively split text', () => {
    const text =
      'Hello world.\n\nThis is a test of the recursive splitting system.\nIt should handle multiple lines and different separators appropriately.';
    const chunks = splitter.splitText(text);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(chunk => {
      expect(chunk.length).toBeLessThanOrEqual(50);
    });
  });

  it('should handle language-specific splitting', () => {
    const tsSplitter = RecursiveCharacterTextSplitter.fromLanguage(Language.TS, {
      chunkSize: 50,
      chunkOverlap: 5,
    });

    const tsCode = `
        interface User {
          name: string;
          age: number;
        }
  
        function greet(user: User) {
          console.log(\`Hello \${user.name}\`);
        }
      `;

    const chunks = tsSplitter.splitText(tsCode);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.some(chunk => chunk.includes('interface'))).toBe(true);
    expect(chunks.some(chunk => chunk.includes('function'))).toBe(true);
  });

  it('should maintain context with overlap', () => {
    const text = 'This is a test.\nIt has multiple lines.\nEach line should be handled properly.';
    const chunks = splitter.splitText(text);

    // Check that consecutive chunks have some overlap
    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1];
      const currentChunk = chunks[i];

      // Find common text between consecutive chunks
      const hasOverlap = prevChunk?.split(' ').some(word => currentChunk?.includes(word));

      expect(hasOverlap).toBe(true);
    }
  });

  it('should throw error for unsupported language', () => {
    expect(() => {
      // @ts-expect-error - Testing invalid language
      RecursiveCharacterTextSplitter.fromLanguage('invalid-language');
    }).toThrow();
  });
});
