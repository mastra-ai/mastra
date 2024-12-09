import { RecursiveJsonTransformer } from './json';

describe('RecursiveJsonTransformer', () => {
  let jsonT: RecursiveJsonTransformer;

  beforeEach(() => {
    jsonT = new RecursiveJsonTransformer({ maxChunkSize: 100, minChunkSize: 50 });
  });

  describe('Unicode handling', () => {
    it('should handle Unicode characters correctly', () => {
      const input = {
        key1: '你好',
        key2: '世界',
      };

      const splitter = new RecursiveJsonTransformer({ maxChunkSize: 50 });

      const chunks = splitter.splitText({
        jsonData: input,
        ensureAscii: true,
      });

      expect(chunks.some(chunk => chunk.includes('\\u'))).toBe(true);

      const combined = chunks
        .map(chunk => {
          const c = JSON.parse(chunk);
          const retVal: Record<string, string> = {};
          Object.entries(c).forEach(([key, value]) => {
            console.log(key, value);
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

    it('should handle non-ASCII without escaping when ensureAscii is false', () => {
      const input = {
        key1: '你好',
        key2: '世界',
      };

      const splitter = new RecursiveJsonTransformer({ maxChunkSize: 50 });

      const chunksWithoutEscaping = splitter.splitText({
        jsonData: input,
        ensureAscii: false,
      });

      expect(chunksWithoutEscaping.some(chunk => chunk.includes('你好'))).toBe(true);

      const combined = chunksWithoutEscaping
        .map(chunk => JSON.parse(chunk))
        .reduce((acc, curr) => ({ ...acc, ...curr }), {});

      expect(combined.key1).toBe('你好');
      expect(combined.key2).toBe('世界');
    });
  });

  describe('splitText', () => {
    it('should return JSON strings', () => {
      const input = {
        key1: 'value1',
        key2: 'value2',
      };

      const chunks = jsonT.splitText({ jsonData: input });
      chunks.forEach(chunk => {
        expect(() => JSON.parse(chunk)).not.toThrow();
      });
    });
    it('should handle non-ASCII characters', () => {
      const input = {
        key1: '你好',
        key2: '世界',
      };

      const chunks = jsonT.splitText({ jsonData: input, convertLists: false, ensureAscii: false });
      chunks.forEach(chunk => {
        expect(chunk).toContain('你好');
      });
    });
  });

  describe('createDocuments', () => {
    it('should create documents with metadata', () => {
      const texts = [{ key1: 'value1' }, { key2: 'value2' }];
      const metadatas = [{ source: 'doc1' }, { source: 'doc2' }];

      const documents = jsonT.createDocuments({ texts, convertLists: false, ensureAscii: true, metadatas });
      expect(documents.length).toBeGreaterThan(0);
      documents.forEach((doc, i) => {
        expect(doc?.metadata()?.source).toBe(metadatas?.[i]?.source);
      });
    });

    it('should handle empty metadata', () => {
      const texts = [{ key: 'value' }];
      const documents = jsonT.createDocuments({ texts });
      expect(documents.length).toBeGreaterThan(0);
      documents.forEach(doc => {
        expect(doc.metadata()).toEqual({});
      });
    });
  });
});
