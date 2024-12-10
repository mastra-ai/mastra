import { Document } from 'llamaindex';

import { ChunkOptions } from '../types';

import { Transformer } from './transformer';

export abstract class TextTransformer implements Transformer {
  protected chunkSize: number;
  protected chunkOverlap: number;
  protected lengthFunction: (text: string) => number;
  protected keepSeparator: boolean | 'start' | 'end';
  protected addStartIndex: boolean;
  protected stripWhitespace: boolean;

  constructor({
    chunkSize = 4000,
    chunkOverlap = 200,
    lengthFunction = (text: string) => text.length,
    keepSeparator = false,
    addStartIndex = false,
    stripWhitespace = true,
  }: ChunkOptions) {
    if (chunkOverlap > chunkSize) {
      throw new Error(
        `Got a larger chunk overlap (${chunkOverlap}) than chunk size ` + `(${chunkSize}), should be smaller.`,
      );
    }
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
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
          const offset = index + previousChunkLen - this.chunkOverlap;
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
    const separatorLen = this.lengthFunction(separator);
    const docs: string[] = [];
    let currentDoc: string[] = [];
    let total = 0;

    splits.forEach(d => {
      const len = this.lengthFunction(d);
      if (total + len + (currentDoc.length > 0 ? separatorLen : 0) > this.chunkSize) {
        if (total > this.chunkSize) {
          console.warn(`Created a chunk of size ${total}, ` + `which is longer than the specified ${this.chunkSize}`);
        }
        if (currentDoc.length > 0) {
          const doc = this.joinDocs(currentDoc, separator);
          if (doc !== null) {
            docs.push(doc);
          }
          while (
            total > this.chunkOverlap ||
            (total + len + (currentDoc.length > 0 ? separatorLen : 0) > this.chunkSize && total > 0)
          ) {
            total -= this.lengthFunction(currentDoc?.[0]!) + (currentDoc.length > 1 ? separatorLen : 0);
            currentDoc = currentDoc.slice(1);
          }
        }
      }
      currentDoc.push(d);
      total += len + (currentDoc.length > 1 ? separatorLen : 0);
    });

    const doc = this.joinDocs(currentDoc, separator);
    if (doc !== null) {
      docs.push(doc);
    }
    return docs;
  }
}
