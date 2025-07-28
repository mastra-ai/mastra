import { Document } from '../schema';
import type { SentenceChunkOptions } from '../types';
import type { Transformer } from './transformer';

export class SentenceTransformer implements Transformer {
  protected minSize: number;
  protected maxSize: number;
  protected targetSize: number;
  protected overlap: number;
  protected sentenceEnders: string[];
  protected preserveWhitespace: boolean;
  protected fallbackToWords: boolean;
  protected keepSeparator: boolean;
  protected lengthFunction: (text: string) => number;
  protected addStartIndex: boolean;
  protected stripWhitespace: boolean;

  constructor({
    minSize = 50,
    maxSize,
    targetSize,
    overlap = 0,
    sentenceEnders = ['.', '!', '?'],
    preserveWhitespace = true,
    fallbackToWords = true,
    keepSeparator = false,
    lengthFunction = (text: string) => text.length,
    addStartIndex = false,
    stripWhitespace = true,
  }: SentenceChunkOptions) {
    if (!maxSize) {
      throw new Error('maxSize is required for sentence chunking');
    }
    if (overlap >= maxSize) {
      throw new Error(`Overlap (${overlap}) must be smaller than maxSize (${maxSize})`);
    }
    if (minSize > maxSize) {
      throw new Error(`minSize (${minSize}) must be smaller than or equal to maxSize (${maxSize})`);
    }

    this.minSize = minSize;
    this.maxSize = maxSize;
    this.targetSize = targetSize ?? Math.floor(maxSize * 0.8);
    this.overlap = overlap;
    this.sentenceEnders = sentenceEnders;
    this.preserveWhitespace = preserveWhitespace;
    this.fallbackToWords = fallbackToWords;
    this.keepSeparator = typeof keepSeparator === 'boolean' ? keepSeparator : false;
    this.lengthFunction = lengthFunction;
    this.addStartIndex = addStartIndex;
    this.stripWhitespace = stripWhitespace;
  }

  /**
   * Split text into sentences using configured sentence endings
   */
  private splitIntoSentences(text: string): string[] {
    if (!text) return [];

    // Create regex pattern from sentence enders
    const pattern = this.sentenceEnders.map(ender => ender.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

    const regex = new RegExp(`(${pattern})`, 'g');

    // Split text while preserving separators
    const parts = text.split(regex);
    const sentences: string[] = [];

    for (let i = 0; i < parts.length; i += 2) {
      const sentence = parts[i] || '';
      const separator = parts[i + 1] || '';

      if (sentence.trim()) {
        const fullSentence = this.keepSeparator ? sentence + separator : sentence;

        const finalSentence = this.stripWhitespace ? fullSentence.trim() : fullSentence;

        if (finalSentence) {
          sentences.push(finalSentence);
        }
      }
    }

    return sentences;
  }

  /**
   * Split a long sentence into words as fallback
   */
  private splitSentenceIntoWords(sentence: string): string[] {
    if (!this.fallbackToWords) {
      return [sentence]; // Return as-is if fallback disabled
    }

    const words = sentence.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const word of words) {
      const testChunk = currentChunk ? currentChunk + ' ' + word : word;

      if (this.lengthFunction(testChunk) <= this.maxSize) {
        currentChunk = testChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        // If single word is too long, split it character-wise as last resort
        if (this.lengthFunction(word) > this.maxSize) {
          chunks.push(...this.splitWordIntoChars(word));
          currentChunk = '';
        } else {
          currentChunk = word;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Split a word into character chunks as absolute last resort
   */
  private splitWordIntoChars(word: string): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    for (const char of word) {
      if (this.lengthFunction(currentChunk + char) <= this.maxSize) {
        currentChunk += char;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = char;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Group sentences into chunks that fit within size constraints
   */
  private groupSentencesIntoChunks(sentences: string[]): string[] {
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;

    const separator = this.preserveWhitespace ? ' ' : ' ';

    for (const sentence of sentences) {
      const sentenceSize = this.lengthFunction(sentence);
      const separatorSize = currentChunk.length > 0 ? this.lengthFunction(separator) : 0;
      const totalSize = currentSize + separatorSize + sentenceSize;

      // If this sentence alone exceeds maxSize, handle it specially
      if (sentenceSize > this.maxSize) {
        // Flush current chunk first
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join(separator));
          currentChunk = [];
          currentSize = 0;
        }

        // Split the oversized sentence
        const sentenceChunks = this.splitSentenceIntoWords(sentence);
        chunks.push(...sentenceChunks);
        continue;
      }

      // If adding this sentence would exceed maxSize
      if (totalSize > this.maxSize) {
        // Only flush if we have something in the current chunk
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join(separator));
          currentChunk = [sentence];
          currentSize = sentenceSize;
        } else {
          // This shouldn't happen given our size check above, but handle it
          currentChunk = [sentence];
          currentSize = sentenceSize;
        }
      } else {
        // Add sentence to current chunk
        currentChunk.push(sentence);
        currentSize = totalSize;

        // If we've reached our target size, flush the chunk
        if (currentSize >= this.targetSize) {
          chunks.push(currentChunk.join(separator));
          currentChunk = [];
          currentSize = 0;
        }
      }
    }

    // Flush remaining sentences
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(separator));
    }

    return chunks;
  }

  /**
   * Add overlap between chunks
   */
  private addOverlapToChunks(chunks: string[]): string[] {
    if (this.overlap === 0 || chunks.length <= 1) {
      return chunks;
    }

    const overlappedChunks: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i] || '';

      // Add overlap from previous chunk
      if (i > 0 && this.overlap > 0) {
        const prevChunk = chunks[i - 1] || '';
        const overlapText = this.extractOverlap(prevChunk, this.overlap);

        if (overlapText) {
          const separator = this.preserveWhitespace ? ' ' : ' ';
          chunk = overlapText + separator + chunk;
        }
      }

      overlappedChunks.push(chunk);
    }

    return overlappedChunks;
  }

  /**
   * Extract overlap text from the end of a chunk
   */
  private extractOverlap(text: string, overlapSize: number): string {
    if (overlapSize === 0 || !text) return '';

    // Try to extract complete sentences for overlap
    const sentences = this.splitIntoSentences(text);
    let overlapText = '';

    // Work backwards through sentences until we exceed overlap size
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i] || '';
      const testOverlap = sentence + (overlapText ? ' ' + overlapText : '');

      if (this.lengthFunction(testOverlap) <= overlapSize) {
        overlapText = testOverlap;
      } else {
        break;
      }
    }

    // If no complete sentences fit, fall back to character-based overlap
    if (!overlapText && text.length > overlapSize) {
      overlapText = text.slice(-overlapSize);
    }

    return overlapText;
  }

  /**
   * Main method to split text into sentence-aware chunks
   */
  splitText({ text }: { text: string }): string[] {
    if (!text) return [];

    // Step 1: Split into sentences
    const sentences = this.splitIntoSentences(text);

    // Step 2: Group sentences into chunks
    const chunks = this.groupSentencesIntoChunks(sentences);

    // Step 3: Add overlap if configured
    const overlappedChunks = this.addOverlapToChunks(chunks);

    return overlappedChunks.filter(chunk => chunk.trim().length > 0);
  }

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
}
