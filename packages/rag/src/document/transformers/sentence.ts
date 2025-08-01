import type { SentenceChunkOptions } from '../types';
import { TextTransformer } from './text';

export class SentenceTransformer extends TextTransformer {
  protected minSize: number;
  protected maxSize: number;
  protected targetSize: number;
  protected sentenceEnders: string[];
  protected fallbackToWords: boolean;
  protected fallbackToCharacters: boolean;
  protected keepSeparator: boolean | 'start' | 'end';

  constructor(options: SentenceChunkOptions) {
    // Ensure overlap doesn't exceed maxSize for parent validation
    const parentOverlap = Math.min(options.overlap ?? 0, options.maxSize - 1);

    const baseOptions = {
      ...options,
      overlap: parentOverlap, // Use adjusted overlap for parent
    };

    super(baseOptions);

    this.maxSize = options.maxSize;
    this.minSize = options.minSize ?? 50;
    this.targetSize = options.targetSize ?? Math.floor(options.maxSize * 0.8);
    this.sentenceEnders = options.sentenceEnders ?? ['.', '!', '?'];
    this.fallbackToWords = options.fallbackToWords ?? true;
    this.fallbackToCharacters = options.fallbackToCharacters ?? true;
    this.keepSeparator = options.keepSeparator ?? false;

    // Override with original overlap for our sentence logic
    this.overlap = options.overlap ?? 0;
  }

  private detectSentenceBoundaries(text: string): string[] {
    if (!text) return [];

    const sentences: string[] = [];
    let currentSentence = '';
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      if (!char) break; // Safety check

      currentSentence += char;

      if (this.sentenceEnders.includes(char)) {
        const remainingText = text.slice(i + 1);

        if (this.isRealSentenceBoundary(currentSentence, remainingText)) {
          sentences.push(currentSentence.trim());
          currentSentence = '';
        }
      }
      i++;
    }

    if (currentSentence.trim()) {
      sentences.push(currentSentence.trim());
    }

    return sentences.filter(s => s.length > 0);
  }

  private isRealSentenceBoundary(currentSentence: string, remainingText: string): boolean {
    if (!remainingText.trim()) {
      return true;
    }

    if (!/^\s+[A-Z]/.test(remainingText)) {
      return false;
    }

    const words = currentSentence.trim().split(/\s+/);
    const lastWord = words[words.length - 1] || '';

    const baseWord = lastWord.slice(0, -1);

    if (this.isCommonAbbreviation(baseWord)) {
      return false;
    }

    return true;
  }

  private isCommonAbbreviation(word: string): boolean {
    // Common titles
    const titles = ['Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sr', 'Jr'];
    if (titles.includes(word)) {
      return true;
    }

    // Multi-character abbreviations with periods (U.S.A., a.m., p.m., etc.)
    if (/^[A-Z](\.[A-Z])*$/.test(word) || /^[a-z](\.[a-z])*$/.test(word)) {
      return true;
    }

    // Single capital letters (initials)
    if (/^[A-Z]$/.test(word)) {
      return true;
    }

    // Numbers (versions, decimals)
    if (/^\d+$/.test(word)) {
      return true;
    }

    // Time abbreviations
    if (/^[ap]\.?m$/i.test(word)) {
      return true;
    }

    return false;
  }

  /**
   * Group sentences into chunks with integrated overlap processing
   */
  private groupSentencesIntoChunks(sentences: string[]): string[] {
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;

    const separator = ' ';

    for (const sentence of sentences) {
      const sentenceLength = this.lengthFunction(sentence);
      const separatorLength = currentChunk.length > 0 ? this.lengthFunction(separator) : 0;
      const totalLength = currentSize + sentenceLength + separatorLength;

      // Handle oversized sentences with fallback strategies
      if (sentenceLength > this.maxSize) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join(separator));
          currentChunk = [];
          currentSize = 0;
        }

        const fallbackChunks = this.handleOversizedSentence(sentence);
        chunks.push(...fallbackChunks);
        continue;
      }

      // If adding this sentence would exceed maxSize, finalize current chunk
      if (currentChunk.length > 0 && totalLength > this.maxSize) {
        chunks.push(currentChunk.join(separator));

        const overlapSentences = this.calculateSentenceOverlap(currentChunk);
        currentChunk = overlapSentences;
        currentSize = this.calculateChunkSize(currentChunk);
      }

      currentChunk.push(sentence);
      currentSize += sentenceLength + separatorLength;

      // If we've reached our target size, consider finalizing the chunk
      if (currentSize >= this.targetSize) {
        chunks.push(currentChunk.join(separator));

        const overlapSentences = this.calculateSentenceOverlap(currentChunk);
        currentChunk = overlapSentences;
        currentSize = this.calculateChunkSize(currentChunk);
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(separator));
    }

    return chunks;
  }

  /**
   * Handle oversized sentences with fallback strategies
   */
  private handleOversizedSentence(sentence: string): string[] {
    // First fallback
    if (this.fallbackToWords) {
      const wordChunks = this.splitSentenceIntoWords(sentence);
      if (wordChunks.length > 1) {
        return wordChunks;
      }
    }

    // Second fallback
    if (this.fallbackToCharacters) {
      return this.splitSentenceIntoCharacters(sentence);
    }

    // Last resort
    console.warn(
      `Sentence exceeds maxSize (${this.maxSize}) and fallbacks are disabled: "${sentence.substring(0, 50)}..."`,
    );
    return [sentence];
  }

  private splitSentenceIntoWords(sentence: string): string[] {
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

        if (this.lengthFunction(word) > this.maxSize) {
          if (this.fallbackToCharacters) {
            chunks.push(...this.splitSentenceIntoCharacters(word));
          } else {
            chunks.push(word);
          }
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

  private splitSentenceIntoCharacters(text: string): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    for (const char of text) {
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

  private calculateSentenceOverlap(currentChunk: string[]): string[] {
    if (this.overlap === 0 || currentChunk.length === 0) {
      return [];
    }

    const overlapSentences: string[] = [];
    let overlapSize = 0;
    const separator = ' ';

    // Work backwards through sentences to build overlap
    for (let i = currentChunk.length - 1; i >= 0; i--) {
      const sentence = currentChunk[i];
      if (!sentence) continue;

      const sentenceLength = this.lengthFunction(sentence);
      const separatorLength = overlapSentences.length > 0 ? this.lengthFunction(separator) : 0;

      if (overlapSize + sentenceLength + separatorLength > this.overlap) {
        break;
      }

      overlapSentences.unshift(sentence);
      overlapSize += sentenceLength + separatorLength;
    }

    return overlapSentences;
  }

  private calculateChunkSize(sentences: string[]): number {
    if (!sentences || sentences.length === 0) {
      return 0;
    }

    let totalSize = 0;
    const separator = ' ';

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i]!;
      totalSize += this.lengthFunction(sentence);

      // Add separator length for all but the last sentence
      if (i < sentences.length - 1) {
        totalSize += this.lengthFunction(separator);
      }
    }

    return totalSize;
  }

  splitText({ text }: { text: string }): string[] {
    if (!text) return [];

    const sentences = this.detectSentenceBoundaries(text);

    const chunks = this.groupSentencesIntoChunks(sentences);

    return chunks.filter(chunk => chunk.trim().length > 0);
  }
}
