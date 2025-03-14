import { Document } from 'llamaindex';

import type { ChunkOptions } from '../types';

import type { Transformer } from './transformer';

export abstract class TextTransformer implements Transformer {
  protected size: number;
  protected overlap: number;
  protected lengthFunction: (text: string) => number;
  protected keepSeparator: boolean | 'start' | 'end';
  protected addStartIndex: boolean;
  protected stripWhitespace: boolean;

  constructor({
    size = 4000,
    overlap = 200,
    lengthFunction = (text: string) => text.length,
    keepSeparator = false,
    addStartIndex = false,
    stripWhitespace = true,
  }: ChunkOptions) {
    if (overlap > size) {
      throw new Error(`Got a larger chunk overlap (${overlap}) than chunk size ` + `(${size}), should be smaller.`);
    }
    this.size = size;
    this.overlap = overlap;
    this.lengthFunction = lengthFunction;
    this.keepSeparator = keepSeparator;
    this.addStartIndex = addStartIndex;
    this.stripWhitespace = stripWhitespace;
  }

  setAddStartIndex(value: boolean): void {
    this.addStartIndex = value;
  }

  abstract splitText({ text }: { text: string }): string[];

  createDocuments(texts: string[], metadatas?: Record<string, any>[]): Document[] {
    const _metadatas = metadatas || Array(texts.length).fill({});
    const documents: Document[] = [];

    texts.forEach((text, i) => {
      let index = 0;
      let previousChunkLen = 0;

      this.splitText({ text }).forEach(chunk => {
        const metadata = { ..._metadatas[i] };
        if (this.addStartIndex) {
          const offset = index + previousChunkLen - this.overlap;
          index = text.indexOf(chunk, Math.max(0, offset));
          metadata.startIndex = index;
          previousChunkLen = chunk.length;
        }
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

  splitDocuments(documents: Document[]): Document[] {
    const texts: string[] = [];
    const metadatas: Record<string, any>[] = [];
    for (const doc of documents) {
      texts.push(doc.text);
      metadatas.push(doc.metadata);
    }
    return this.createDocuments(texts, metadatas);
  }

  transformDocuments(documents: Document[]): Document[] {
    const texts: string[] = [];
    const metadatas: Record<string, any>[] = [];

    for (const doc of documents) {
      texts.push(doc.text);
      metadatas.push(doc.metadata);
    }

    return this.createDocuments(texts, metadatas);
  }

  protected joinDocs(docs: string[], separator: string): string | null {
    let text = docs.join(separator);
    if (this.stripWhitespace) {
      text = text.trim();
    }
    return text === '' ? null : text;
  }

  protected mergeSplits(splits: string[], separator: string): string[] {
    const docs: string[] = [];
    let currentDoc: string[] = [];
    let total = 0;

    for (const d of splits) {
      const len = this.lengthFunction(d);
      const separatorLen = separator ? this.lengthFunction(separator) : 0;

      if (total + len + (currentDoc.length > 0 ? separatorLen : 0) > this.size) {
        if (total > this.size) {
          console.warn(`Created a chunk of size ${total}, which is longer than the specified ${this.size}`);
        }

        if (currentDoc.length > 0) {
          const doc = this.joinDocs(currentDoc, separator);
          if (doc !== null) {
            docs.push(doc);
          }

          // Handle overlap: keep enough content from the end of current chunk
          if (this.overlap > 0) {
            let overlapContent: string[] = [];
            let overlapSize = 0;

            // Work backwards through currentDoc until we have enough overlap
            for (let i = currentDoc.length - 1; i >= 0; i--) {
              const piece = currentDoc[i]!;
              const pieceLen = this.lengthFunction(piece);

              if (overlapSize + pieceLen > this.overlap) {
                break;
              }

              overlapContent.unshift(piece);
              overlapSize += pieceLen + (overlapContent.length > 1 ? separatorLen : 0);
            }

            currentDoc = overlapContent;
            total = overlapSize;
          } else {
            currentDoc = [];
            total = 0;
          }
        }
      }

      currentDoc.push(d);
      total += len + (currentDoc.length > 1 ? separatorLen : 0);
    }

    if (currentDoc.length > 0) {
      const doc = this.joinDocs(currentDoc, separator);
      if (doc !== null) {
        docs.push(doc);
      }
    }

    return docs;
  }
}
