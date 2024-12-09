import { CharacterTransformer, RecursiveCharacterTransformer } from './character';
import { Language } from './types';

describe('CharacterTransformer', () => {
  let splitter: CharacterTransformer;

  beforeEach(() => {
    splitter = new CharacterTransformer({
      separator: '\n\n',
      isSeparatorRegex: false,
      options: {
        chunkSize: 50,
        chunkOverlap: 5,
      },
    });
  });

  it('should split text on simple separator', () => {
    const text = 'Hello world\n\nHow are you\n\nI am fine';
    const chunks = splitter.splitText({ text });

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toBe('Hello world');
    expect(chunks[1]).toBe('How are you');
    expect(chunks[2]).toBe('I am fine');
  });

  it('should handle regex separator', () => {
    const regexSplitter = new CharacterTransformer({
      separator: '\\s+',
      isSeparatorRegex: true,
      options: {
        chunkSize: 50,
        chunkOverlap: 5,
      },
    });

    const text = 'Hello   world\n\nHow    are    you';
    const chunks = regexSplitter.splitText({ text });

    expect(chunks.join(' ')).toBe('Hello world How are you');
  });

  it('should keep separator when specified', () => {
    const splitterWithSeparator = new CharacterTransformer({
      separator: '\n\n',
      isSeparatorRegex: false,
      options: {
        chunkSize: 50,
        chunkOverlap: 5,
        keepSeparator: 'end',
      },
    });

    const text = 'Hello\n\nWorld';
    const chunks = splitterWithSeparator.splitText({ text });

    expect(chunks[0]).toBe('Hello\n\n');
    expect(chunks[1]).toBe('World');
  });

  describe('separator handling', () => {
    it('should keep separator at end when specified', () => {
      const splitterWithSeparator = new CharacterTransformer({
        separator: '\n\n',
        isSeparatorRegex: false,
        options: {
          chunkSize: 50,
          chunkOverlap: 5,
          keepSeparator: 'end',
        },
      });

      const text = 'Hello\n\nWorld';
      const chunks = splitterWithSeparator.splitText({ text });

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toBe('Hello\n\n');
      expect(chunks[1]).toBe('World');
    });

    it('should keep separator at start when specified', () => {
      const splitterWithSeparator = new CharacterTransformer({
        separator: '\n\n',
        isSeparatorRegex: false,
        options: {
          chunkSize: 50,
          chunkOverlap: 5,
          keepSeparator: 'start',
        },
      });

      const text = 'Hello\n\nWorld\n\nTest';
      const chunks = splitterWithSeparator.splitText({ text });

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toBe('Hello');
      expect(chunks[1]).toBe('\n\nWorld');
      expect(chunks[2]).toBe('\n\nTest');
    });

    it('should handle multiple consecutive separators', () => {
      const splitterWithSeparator = new CharacterTransformer({
        separator: '\n\n',
        isSeparatorRegex: false,
        options: {
          chunkSize: 50,
          chunkOverlap: 5,
          keepSeparator: 'end',
        },
      });

      const text = 'Hello\n\n\n\nWorld';
      const chunks = splitterWithSeparator.splitText({ text });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toBe(text);
    });

    it('should handle text ending with separator', () => {
      const splitterWithSeparator = new CharacterTransformer({
        separator: '\n\n',
        isSeparatorRegex: false,
        options: {
          chunkSize: 50,
          chunkOverlap: 5,
          keepSeparator: 'end',
        },
      });

      const text = 'Hello\n\nWorld\n\n';
      const chunks = splitterWithSeparator.splitText({ text });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toBe(text);
    });

    it('should handle text starting with separator', () => {
      const splitterWithSeparator = new CharacterTransformer({
        separator: '\n\n',
        isSeparatorRegex: false,
        options: {
          chunkSize: 50,
          chunkOverlap: 5,
          keepSeparator: 'start',
        },
      });

      const text = '\n\nHello\n\nWorld';
      const chunks = splitterWithSeparator.splitText({ text });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toBe(text);
    });
  });
});

describe('RecursiveCharacterTransformer', () => {
  let splitter: RecursiveCharacterTransformer;

  beforeEach(() => {
    splitter = new RecursiveCharacterTransformer({
      separators: ['\n\n', '\n', ' ', ''],
      isSeparatorRegex: false,
      options: {
        chunkSize: 50,
        chunkOverlap: 5,
      },
    });
  });

  it('should recursively split text', () => {
    const text =
      'Hello world.\n\nThis is a test of the recursive splitting system.\nIt should handle multiple lines and different separators appropriately.';
    const chunks = splitter.splitText({ text });

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(chunk => {
      expect(chunk.length).toBeLessThanOrEqual(50);
    });
  });

  it('should handle language-specific splitting', () => {
    const tsSplitter = RecursiveCharacterTransformer.fromLanguage(Language.TS, {
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

    const chunks = tsSplitter.splitText({ text: tsCode });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.some(chunk => chunk.includes('interface'))).toBe(true);
    expect(chunks.some(chunk => chunk.includes('function'))).toBe(true);
  });

  it('should maintain context with overlap', () => {
    const text = 'This is a test.\nIt has multiple lines.\nEach line should be handled properly.';
    const chunks = splitter.splitText({ text });

    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1];
      const currentChunk = chunks[i];

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
