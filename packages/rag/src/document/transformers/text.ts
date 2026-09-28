import { Document } from '../schema';

import type { BaseChunkOptions } from '../types';

import type { Transformer } from './transformer';

export abstract class TextTransformer implements Transformer {
  protected maxSize: number;
  protected overlap: number;
  protected lengthFunction: (text: string) => number;
  protected separatorPosition?: 'start' | 'end';
  protected addStartIndex: boolean;
  protected stripWhitespace: boolean;

  constructor({
    maxSize = 4000,
    overlap = 200,
    lengthFunction = (text: string) => text.length,
    separatorPosition,
    addStartIndex = false,
    stripWhitespace = true,
  }: BaseChunkOptions) {
    if (overlap >= maxSize) {
      throw new Error(`Chunk overlap (${overlap}) must be smaller than chunk size (${maxSize}).`);
    }
    this.maxSize = maxSize;
    this.overlap = overlap;
    this.lengthFunction = lengthFunction;
    this.separatorPosition = separatorPosition;
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

  /**
   * Merges splits into chunks of at most `maxSize`.
   * `joiners[i]`, when given, is the text placed before `splits[i]` when it is
   * joined to a preceding piece; otherwise `separator` is used for every piece.
   */
  protected mergeSplits(splits: string[], separator: string, joiners?: string[]): string[] {
    const docs: string[] = [];
    let currentDoc: string[] = [];
    let currentJoiners: string[] = [];
    let total = 0;
    const lengthOf = (s: string | undefined) => (s ? this.lengthFunction(s) : 0);
    const join = (pieces: string[], pieceJoiners: string[]) => {
      if (!joiners) return this.joinDocs(pieces, separator);
      const text = pieces.map((piece, i) => (i === 0 ? piece : pieceJoiners[i] + piece)).join('');
      return this.joinDocs([text], '');
    };

    splits.forEach((d, index) => {
      const len = this.lengthFunction(d);
      const joiner = joiners ? (joiners[index] ?? separator) : separator;
      const separatorLen = lengthOf(joiner);

      if (total + len + (currentDoc.length > 0 ? separatorLen : 0) > this.maxSize) {
        if (total > this.maxSize) {
          console.warn(`Created a chunk of size ${total}, which is longer than the specified ${this.maxSize}`);
        }

        if (currentDoc.length > 0) {
          const doc = join(currentDoc, currentJoiners);
          if (doc !== null) {
            docs.push(doc);
          }

          // Handle overlap: keep enough content from the end of current chunk
          if (this.overlap > 0) {
            const overlapContent: string[] = [];
            const overlapJoiners: string[] = [];
            let overlapSize = 0;

            // Work backwards through currentDoc until we have enough overlap
            for (let i = currentDoc.length - 1; i >= 0; i--) {
              const piece = currentDoc[i]!;
              const pieceLen = this.lengthFunction(piece);

              if (overlapSize + pieceLen > this.overlap) {
                break;
              }

              overlapContent.unshift(piece);
              overlapJoiners.unshift(currentJoiners[i]!);
              overlapSize += pieceLen + (overlapContent.length > 1 ? lengthOf(overlapJoiners[1]) : 0);
            }

            // Drop from the front of the overlap window until the incoming
            // split fits under maxSize, so the next chunk never exceeds it.
            while (overlapContent.length > 0 && overlapSize + len + separatorLen > this.maxSize) {
              const removed = overlapContent.shift()!;
              overlapJoiners.shift();
              const removedLen = this.lengthFunction(removed);
              overlapSize -= removedLen + (overlapContent.length > 0 ? lengthOf(overlapJoiners[0]) : 0);
            }

            currentDoc = overlapContent;
            currentJoiners = overlapJoiners;
            total = overlapSize;
          } else {
            currentDoc = [];
            currentJoiners = [];
            total = 0;
          }
        }
      }

      currentDoc.push(d);
      currentJoiners.push(joiner);
      total += len + (currentDoc.length > 1 ? separatorLen : 0);
    });

    if (currentDoc.length > 0) {
      const doc = join(currentDoc, currentJoiners);
      if (doc !== null) {
        docs.push(doc);
      }
    }

    return docs;
  }
}
