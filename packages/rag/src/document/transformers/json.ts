import { Document } from 'llamaindex';

export class RecursiveJsonTransformer {
  private maxSize: number;
  private minSize: number;

  constructor({ maxSize = 2000, minSize }: { maxSize: number; minSize?: number }) {
    this.maxSize = maxSize;
    this.minSize = minSize ?? Math.max(maxSize - 200, 50);
  }

  private static jsonSize(data: Record<string, any>): number {
    const seen = new WeakSet();

    function getStringifiableData(obj: any): any {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }

      if (seen.has(obj)) {
        return '[Circular]';
      }

      seen.add(obj);

      if (Array.isArray(obj)) {
        const safeArray = [];
        for (const item of obj) {
          safeArray.push(getStringifiableData(item));
        }
        return safeArray;
      }

      const safeObj: Record<string, any> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          safeObj[key] = getStringifiableData(obj[key]);
        }
      }
      return safeObj;
    }

    const stringifiable = getStringifiableData(data);
    const jsonString = JSON.stringify(stringifiable);
    return jsonString.length;
  }

  /**
   * Transform JSON data while handling circular references
   */
  public transform(data: Record<string, any>): Record<string, any> {
    const size = RecursiveJsonTransformer.jsonSize(data);

    const seen = new WeakSet();

    function createSafeCopy(obj: any): any {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }

      if (seen.has(obj)) {
        return '[Circular]';
      }

      seen.add(obj);

      if (Array.isArray(obj)) {
        return obj.map(item => createSafeCopy(item));
      }

      const copy: Record<string, any> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          copy[key] = createSafeCopy(obj[key]);
        }
      }
      return copy;
    }

    return {
      size,
      data: createSafeCopy(data),
    };
  }

  /**
   * Set a value in a nested dictionary based on the given path
   */
  private static setNestedDict(d: Record<string, any>, path: string[], value: any): void {
    let current = d;
    for (const key of path.slice(0, -1)) {
      current[key] = current[key] || {};
      current = current[key];
    }
    current[path[path.length - 1]!] = value;
  }

  /**
   * Convert lists in the JSON structure to dictionaries with index-based keys
   */
  private listToDictPreprocessing(data: any): any {
    if (data && typeof data === 'object') {
      if (Array.isArray(data)) {
        return Object.fromEntries(data.map((item, index) => [String(index), this.listToDictPreprocessing(item)]));
      }
      return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, this.listToDictPreprocessing(v)]));
    }
    return data;
  }

  private handlePrimitiveValue(
    value: any,
    key: string,
    currentChunk: Record<string, any>,
    chunks: Record<string, any>[],
    fullPath: string[],
  ): { currentChunk: Record<string, any>; chunks: Record<string, any>[] } {
    const testValue = { [key]: value };

    if (RecursiveJsonTransformer.jsonSize(testValue) <= this.maxSize) {
      if (RecursiveJsonTransformer.jsonSize({ ...currentChunk, ...testValue }) <= this.maxSize) {
        return {
          currentChunk: { ...currentChunk, ...testValue },
          chunks,
        };
      } else {
        return {
          currentChunk: testValue,
          chunks: [...chunks, currentChunk],
        };
      }
    } else if (typeof value === 'string') {
      const stringChunks = this.splitLongString(value);
      const newChunks = stringChunks
        .map(chunk => {
          const newChunk = {};
          RecursiveJsonTransformer.setNestedDict(newChunk, fullPath, chunk);
          return newChunk;
        })
        .filter(chunk => RecursiveJsonTransformer.jsonSize(chunk) <= this.maxSize);

      return {
        currentChunk,
        chunks: [...chunks, ...newChunks],
      };
    }

    const newChunk = {};
    RecursiveJsonTransformer.setNestedDict(newChunk, fullPath, value);
    return {
      currentChunk,
      chunks: RecursiveJsonTransformer.jsonSize(newChunk) <= this.maxSize ? [...chunks, newChunk] : chunks,
    };
  }

  private createArrayChunk(array: any[], path: string[]): Record<string, any> {
    const chunk: Record<string, any> = {};
    RecursiveJsonTransformer.setNestedDict(chunk, path, array);
    return chunk.root ? chunk.root : chunk;
  }

  private createObjectChunk(object: Record<string, any>, path: string[]): Record<string, any> {
    const chunk: Record<string, any> = {};
    RecursiveJsonTransformer.setNestedDict(chunk, path, object);
    return chunk.root ? chunk.root : chunk;
  }

  private handleArray(
    value: any[],
    key: string,
    currentPath: string[],
    depth: number,
    maxDepth: number,
  ): Record<string, any>[] {
    const path = currentPath.length ? [...currentPath, key] : ['root', key];

    // Try keeping array intact
    const chunk = this.createArrayChunk(value, path);
    if (RecursiveJsonTransformer.jsonSize(chunk) <= this.maxSize) {
      return [chunk];
    }

    const chunks: Record<string, any>[] = [];
    let currentGroup: any[] = [];

    const saveCurrentGroup = () => {
      if (currentGroup.length > 0) {
        chunks.push(this.createArrayChunk(currentGroup, path));
        currentGroup = [];
      }
    };

    for (const item of value) {
      // Try adding item to current group
      const testGroup = [...currentGroup, item];
      const testChunk = this.createArrayChunk(testGroup, path);

      if (RecursiveJsonTransformer.jsonSize(testChunk) <= this.maxSize) {
        currentGroup = testGroup;
        continue;
      }

      // Current group is full
      saveCurrentGroup();

      // Handle the new item
      if (typeof item === 'object' && item !== null) {
        const singleItemArray = [item];
        const singleItemChunk = this.createArrayChunk(singleItemArray, path);

        if (RecursiveJsonTransformer.jsonSize(singleItemChunk) <= this.maxSize) {
          currentGroup = singleItemArray;
        } else {
          const itemPath = [...path, String(chunks.length)];
          const nestedChunks = this.handleNestedObject(item, itemPath, depth + 1, maxDepth);
          chunks.push(...nestedChunks);
        }
      } else {
        currentGroup = [item];
      }
    }

    saveCurrentGroup();
    return chunks;
  }

  private handleNestedObject(
    value: Record<string, any>,
    fullPath: string[],
    depth: number,
    maxDepth: number,
  ): Record<string, any>[] {
    const path = fullPath.length ? fullPath : ['root'];

    // Handle max depth
    if (depth > maxDepth) {
      console.warn(`Maximum depth of ${maxDepth} exceeded, flattening remaining structure`);
      return [this.createObjectChunk(value, path)];
    }

    // Try keeping object intact
    const wholeChunk = this.createObjectChunk(value, path);
    if (RecursiveJsonTransformer.jsonSize(wholeChunk) <= this.maxSize) {
      return [wholeChunk];
    }

    const chunks: Record<string, any>[] = [];
    let currentChunk: Record<string, any> = {};

    const saveCurrentChunk = () => {
      if (Object.keys(currentChunk).length > 0) {
        chunks.push(this.createObjectChunk(currentChunk, path));
        currentChunk = {};
      }
    };

    for (const [key, val] of Object.entries(value)) {
      if (val === undefined) continue;

      // Handle arrays separately
      if (Array.isArray(val)) {
        saveCurrentChunk();
        const arrayChunks = this.handleArray(val, key, path, depth, maxDepth);
        chunks.push(...arrayChunks);
        continue;
      }

      // Try adding to current chunk
      const testChunk = this.createObjectChunk({ ...currentChunk, [key]: val }, path);
      if (RecursiveJsonTransformer.jsonSize(testChunk) <= this.maxSize) {
        currentChunk[key] = val;
        continue;
      }

      // Current chunk is full, save it
      saveCurrentChunk();

      // Handle new value based on type
      if (typeof val === 'object' && val !== null) {
        const nestedChunks = this.handleNestedObject(val, [...path, key], depth + 1, maxDepth);
        chunks.push(...nestedChunks);
      } else {
        currentChunk = { [key]: val };
      }
    }

    saveCurrentChunk();
    return chunks;
  }

  private splitLongString(value: string): string[] {
    const chunks: string[] = [];
    let remaining = value;

    while (remaining.length > 0) {
      const overhead = 20;
      const chunkSize = Math.floor(this.maxSize - overhead);

      if (remaining.length <= chunkSize) {
        chunks.push(remaining);
        break;
      }

      const lastSpace = remaining.slice(0, chunkSize).lastIndexOf(' ');
      const splitAt = lastSpace > 0 ? lastSpace + 1 : chunkSize;

      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt);
    }

    return chunks;
  }

  private jsonSplit({
    data,
    currentPath = [],
    chunks = [{}],
    depth = 0,
    maxDepth = 100,
  }: {
    data: Record<string, any>;
    currentPath?: string[];
    chunks?: Record<string, any>[];
    depth?: number;
    maxDepth?: number;
  }): Record<string, any>[] {
    if (!data || typeof data !== 'object') {
      return chunks;
    }

    if (depth > maxDepth) {
      console.warn(`Maximum depth of ${maxDepth} exceeded, flattening remaining structure`);
      RecursiveJsonTransformer.setNestedDict(chunks[chunks.length - 1] || {}, currentPath, data);
      return chunks;
    }

    let currentChunk = {};
    let accumulatedChunks = chunks;

    for (const [key, value] of Object.entries(data)) {
      const fullPath = [...currentPath, key];

      if (Array.isArray(value)) {
        const arrayChunks = this.handleArray(value, key, currentPath, depth, maxDepth);
        accumulatedChunks = [...accumulatedChunks, ...arrayChunks];
      } else if (typeof value === 'object' && value !== null) {
        const objectChunks = this.handleNestedObject(value, fullPath, depth, maxDepth);
        accumulatedChunks = [...accumulatedChunks, ...objectChunks];
      } else {
        const { currentChunk: newCurrentChunk, chunks: newChunks } = this.handlePrimitiveValue(
          value,
          key,
          currentChunk,
          accumulatedChunks,
          fullPath,
        );
        currentChunk = newCurrentChunk;
        accumulatedChunks = newChunks;
      }
    }

    if (Object.keys(currentChunk).length > 0) {
      accumulatedChunks = [...accumulatedChunks, currentChunk];
    }

    return accumulatedChunks.filter(chunk => Object.keys(chunk).length > 0);
  }

  /**
   * Splits JSON into a list of JSON chunks
   */
  splitJson({
    jsonData,
    convertLists = false,
  }: {
    jsonData: Record<string, any>;
    convertLists?: boolean;
  }): Record<string, any>[] {
    const processedData = convertLists ? this.listToDictPreprocessing(jsonData) : jsonData;

    const chunks = this.jsonSplit({ data: processedData });

    if (Object.keys(chunks[chunks.length - 1] || {}).length === 0) {
      chunks.pop();
    }

    return chunks;
  }

  private escapeNonAscii(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.escapeNonAscii(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.escapeNonAscii(value);
      }
      return result;
    }

    if (typeof obj === 'string') {
      return obj.replace(/[\u0080-\uffff]/g, char => {
        return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
      });
    }

    return obj;
  }
  /**
   * Splits JSON into a list of JSON formatted strings
   */
  splitText({
    jsonData,
    convertLists = false,
    ensureAscii = true,
  }: {
    jsonData: Record<string, any>;
    convertLists?: boolean;
    ensureAscii?: boolean;
  }): string[] {
    const chunks = this.splitJson({ jsonData, convertLists });

    if (ensureAscii) {
      const escapedChunks = chunks.map(chunk => this.escapeNonAscii(chunk));
      return escapedChunks.map(chunk => JSON.stringify(chunk));
    }

    return chunks.map(chunk =>
      JSON.stringify(chunk, (key, value) => {
        if (typeof value === 'string') {
          return value.replace(/\\u[\da-f]{4}/gi, match => String.fromCharCode(parseInt(match.slice(2), 16)));
        }
        return value;
      }),
    );
  }

  /**
   * Create documents from a list of json objects
   */
  createDocuments({
    texts,
    convertLists = false,
    ensureAscii = true,
    metadatas,
  }: {
    texts: string[];
    convertLists?: boolean;
    ensureAscii?: boolean;
    metadatas?: Record<string, any>[];
  }): Document[] {
    const _metadatas = metadatas || Array(texts.length).fill({});
    const documents: Document[] = [];

    texts.forEach((text, i) => {
      const chunks = this.splitText({ jsonData: JSON.parse(text), convertLists, ensureAscii });
      chunks.forEach(chunk => {
        const metadata = { ...(_metadatas[i] || {}) };
        documents.push(
          new Document({
            text: chunk,
            metadata,
          }),
        );
      });
    });

    return documents;
  }

  transformDocuments({
    ensureAscii,
    documents,
    convertLists,
  }: {
    ensureAscii?: boolean;
    convertLists?: boolean;
    documents: Document[];
  }): Document[] {
    const texts: string[] = [];
    const metadatas: Record<string, any>[] = [];

    for (const doc of documents) {
      texts.push(doc.text);
      metadatas.push(doc.metadata);
    }

    return this.createDocuments({
      texts,
      metadatas,

      ensureAscii,
      convertLists,
    });
  }
}
