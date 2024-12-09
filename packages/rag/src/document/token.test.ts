import { MastraDocument } from './document';
import { TokenTransformer } from './token';

describe('TokenTransformer', () => {
  let tokenT: TokenTransformer;

  beforeEach(() => {
    tokenT = TokenTransformer.fromTikToken({
      encodingName: 'cl100k_base',
      options: {
        chunkSize: 10,
        chunkOverlap: 2,
      },
    });
  });

  afterEach(() => {
    tokenT.dispose();
  });

  describe('splitText', () => {
    it('should split text into chunks of appropriate size', () => {
      const text = 'This is a test of the text splitting system.';
      const chunks = tokenT.splitText({ text });

      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(text.length);
      });

      const reconstructed = chunks.join(' ').trim();
      expect(reconstructed).toBe(text);
    });

    it('should handle empty text', () => {
      const chunks = tokenT.splitText({ text: '' });
      expect(chunks).toHaveLength(0);
    });

    it('should handle text shorter than chunk size', () => {
      const text = 'Short text';
      const chunks = tokenT.splitText({ text });
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it('should maintain overlap between chunks', () => {
      const text = 'This is a longer piece of text that should be split into multiple chunks with overlap.';
      const chunks = tokenT.splitText({ text });

      if (chunks.length <= 1) {
        return;
      }

      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1];
        const currentChunk = chunks[i];

        let hasOverlap = false;
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

      const documents = tokenT.createDocuments(texts, metadatas);

      const doc1Chunks = documents.filter(doc => doc.metadata()?.source === 'doc1');
      const doc2Chunks = documents.filter(doc => doc.metadata()?.source === 'doc2');

      expect(doc1Chunks.length).toBeGreaterThan(0);
      expect(doc2Chunks.length).toBeGreaterThan(0);

      doc1Chunks.forEach(doc => {
        expect(doc?.metadata()?.source).toBe('doc1');
      });
      doc2Chunks.forEach(doc => {
        expect(doc?.metadata()?.source).toBe('doc2');
      });

      const reconstructed1 = doc1Chunks
        .map(d => d.content())
        .join(' ')
        .trim();
      const reconstructed2 = doc2Chunks
        .map(d => d.content())
        .join(' ')
        .trim();

      expect(reconstructed1).toBe(texts[0]);
      expect(reconstructed2).toBe(texts[1]);
    });
    it('should handle documents with start index', () => {
      const tokenTWithIndex = TokenTransformer.fromTikToken({
        encodingName: 'gpt2',
        options: {
          chunkSize: 10,
          chunkOverlap: 2,
        },
      });
      tokenTWithIndex.setAddStartIndex(true);

      const text = ['This is a test document with multiple sentences.'];
      const docs = tokenTWithIndex.createDocuments(text);

      docs.forEach(doc => {
        expect(doc?.metadata()).toHaveProperty('startIndex');
        expect(typeof doc?.metadata()?.startIndex).toBe('number');
        expect(doc?.metadata()?.startIndex).toBeGreaterThanOrEqual(0);

        const sourceText = text[0];
        if (sourceText) {
          const actualText = sourceText.substring(doc?.metadata()?.startIndex);
          expect(actualText.startsWith(doc?.content()?.trim()!)).toBe(true);
        }
      });

      tokenTWithIndex.dispose();
    });
  });

  describe('transformDocuments', () => {
    it('should transform documents while preserving metadata', () => {
      const initialDocuments: MastraDocument[] = [
        new MastraDocument({
          text: 'This is a long document that needs to be split into multiple chunks.',
          metadata: { source: 'test1', page: 1 },
        }),
        new MastraDocument({
          text: 'This is another document that also needs to be split properly.',
          metadata: { source: 'test2', page: 2 },
        }),
      ];

      const transformedDocs = tokenT.transformDocuments(initialDocuments);

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
        new TokenTransformer({
          encodingName: 'gpt2',
          options: {
            chunkSize: 100,
            chunkOverlap: 150, // overlap larger than chunk size
          },
        });
      }).toThrow();
    });

    it('should handle invalid encoding name', () => {
      expect(() => {
        TokenTransformer.fromTikToken({ encodingName: 'invalid-encoding' as any });
      }).toThrow();
    });
  });

  describe('Advanced features', () => {
    it('should handle different encodings', () => {
      const gpt3Splitter = TokenTransformer.fromTikToken({
        modelName: 'gpt-3.5-turbo',
      });
      const text = 'This is a test text for different encodings.';
      const chunks = gpt3Splitter.splitText({ text });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join(' ').trim()).toBe(text);

      gpt3Splitter.dispose();
    });

    it('should handle special tokens correctly', () => {
      const tokenTWithSpecial = TokenTransformer.fromTikToken({
        encodingName: 'gpt2',
        options: {
          allowedSpecial: new Set(['<|endoftext|>']),
          disallowedSpecial: new Set(),
        },
      });

      const text = 'Test text <|endoftext|> more text';
      const chunks = tokenTWithSpecial.splitText({ text });

      expect(chunks.join(' ').includes('<|endoftext|>')).toBe(true);

      tokenTWithSpecial.dispose();
    });

    it('should strip whitespace when configured', () => {
      const tokenTWithStrip = TokenTransformer.fromTikToken({
        encodingName: 'gpt2',
        options: {
          chunkSize: 10,
          chunkOverlap: 2,
        },
      });

      const text = '  This has whitespace   ';
      const chunks = tokenTWithStrip.splitText({ text });

      chunks.forEach(chunk => {
        expect(chunk).not.toMatch(/^\s+|\s+$/);
      });

      tokenTWithStrip.dispose();
    });
  });
});
