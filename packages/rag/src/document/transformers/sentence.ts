import type { SentenceChunkOptions } from '../types';
import { TextTransformer } from './text';

export class SentenceTransformer extends TextTransformer {
  protected minSize: number;
  protected maxSize: number;
  protected targetSize: number;
  protected sentenceEnders: string[];
  protected fallbackToWords: boolean;
  protected fallbackToCharacters: boolean;

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

        if (this.isRealSentenceBoundary(currentSentence, remainingText, char)) {
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

  private isRealSentenceBoundary(currentSentence: string, remainingText: string, ender: string): boolean {
    if (!remainingText.trim()) {
      return true;
    }

    // ASCII enders only end a sentence when the next sentence starts with an uppercase
    // or caseless letter after whitespace. Configured non-ASCII enders (CJK, Indic, ...)
    // do not require that whitespace, so the gap is optional for them.
    const gap = this.isAsciiEnder(ender) ? '\\s+' : '\\s*';
    if (!new RegExp(`^${gap}[\\p{Lu}\\p{Lt}\\p{Lo}]`, 'u').test(remainingText)) {
      return false;
    }

    // Question and exclamation marks (and configured Unicode enders) are unambiguous
    // boundaries. Only periods are ambiguous with abbreviations, initials and list markers.
    if (ender !== '.') {
      return true;
    }

    const trimmed = currentSentence.trim();
    const words = trimmed.split(/\s+/);
    const lastWord = words[words.length - 1] || '';
    const baseWord = lastWord.slice(0, -1);
    const previous = words.length >= 2 ? words[words.length - 2] : undefined;
    // Text before the final word, used to spot an earlier numbered-list marker.
    const prefix = lastWord ? trimmed.slice(0, trimmed.length - lastWord.length) : trimmed;

    // A bare integer ending in a period is a numbered-list marker (not a sentence-final
    // number) when one of these holds:
    //  - it opens the sentence (`5. Fifth`);
    //  - it follows a configured ender;
    //  - it starts a line (`\n2. Second`);
    //  - an earlier bare-number marker already appears in the sentence
    //    (`1. First 2. Second`);
    //  - it opens a colon-introduced numbered list whose next item follows immediately
    //    (`Steps: 1. Open 2. Edit`).
    // The colon lookahead is value-independent and bounded to the token that follows, so it
    // never depends on the number's value or reaches a later, unrelated list: a colon-labelled
    // value (`Result: 5. The score was 6. Done.`) and the same prose with `1.`/`2.`
    // (`Result: 1. The score was 2. Done.`) both keep their sentence boundaries.
    // `startsLine` inspects the last line of the prefix directly: the equivalent unanchored
    // `/(?:^|\n)\s*$/` backtracks quadratically over long newline runs.
    const startsLine = /^\s*$/.test(prefix.slice(prefix.lastIndexOf('\n') + 1));
    const hasEarlierMarker = /(?:^|\s)\d+\.\s/.test(prefix);
    const startsColonList = previous !== undefined && previous.endsWith(':') && /^\s*\S+\s+\d+\.\s/.test(remainingText);
    const isListMarker =
      /^\d+$/.test(baseWord) &&
      (!previous ||
        this.sentenceEnders.includes(previous.slice(-1)) ||
        startsLine ||
        hasEarlierMarker ||
        startsColonList);

    return !this.isCommonAbbreviation(baseWord, isListMarker);
  }

  private isAsciiEnder(ender: string): boolean {
    return ender.length === 1 && ender.charCodeAt(0) < 128;
  }

  private isCommonAbbreviation(word: string, isListMarker = false): boolean {
    // Common titles
    const titles = ['Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sr', 'Jr'];
    if (titles.includes(word)) {
      return true;
    }

    // Multi-character abbreviations with periods (U.S.A., a.m., p.m., etc.), including
    // non-ASCII letters so initials like `И.И.` are recognized too.
    if (/^\p{Lu}(\.\p{Lu})*$/u.test(word) || /^\p{Ll}(\.\p{Ll})*$/u.test(word)) {
      return true;
    }

    // Single uppercase letters (initials), Unicode-aware so `И.` or `É.` are kept with
    // the following name just like `J.`.
    if (/^\p{Lu}$/u.test(word)) {
      return true;
    }

    // Numbers (versions, decimals): a bare integer is only an abbreviation in a numbered
    // list context, so sentence-final numbers can end a sentence.
    if (/^\d+$/.test(word)) {
      return isListMarker;
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
    // Number of leading sentences in currentChunk carried over as overlap from the previous chunk
    let carriedCount = 0;

    const separator = ' ';
    const sepLength = this.lengthFunction(separator);

    for (const sentence of sentences) {
      const sentenceLength = this.lengthFunction(sentence);

      // Handle oversized sentences with fallback strategies
      if (sentenceLength > this.maxSize) {
        if (currentChunk.length > carriedCount) {
          chunks.push(currentChunk.join(separator));
        }
        currentChunk = [];
        currentSize = 0;
        carriedCount = 0;

        const fallbackChunks = this.handleOversizedSentence(sentence);
        chunks.push(...fallbackChunks);
        continue;
      }

      // If adding this sentence would exceed maxSize, finalize current chunk
      if (currentChunk.length > 0 && currentSize + sepLength + sentenceLength > this.maxSize) {
        if (currentChunk.length > carriedCount) {
          chunks.push(currentChunk.join(separator));
        }

        const overlapSentences = this.calculateSentenceOverlap(currentChunk);
        // Trim overlap from the front until the incoming sentence fits
        let overlapSize = this.calculateChunkSize(overlapSentences);
        let start = 0;
        while (start < overlapSentences.length && overlapSize + sepLength + sentenceLength > this.maxSize) {
          overlapSize -= this.lengthFunction(overlapSentences[start]!);
          if (start < overlapSentences.length - 1) overlapSize -= sepLength;
          start++;
        }
        currentChunk = overlapSentences.slice(start);
        carriedCount = currentChunk.length;
        currentSize = currentChunk.length > 0 ? overlapSize : 0;
      }

      currentSize += sentenceLength + (currentChunk.length > 0 ? sepLength : 0);
      currentChunk.push(sentence);

      // If we've reached our target size, consider finalizing the chunk
      if (currentSize >= this.targetSize) {
        chunks.push(currentChunk.join(separator));

        currentChunk = this.calculateSentenceOverlap(currentChunk);
        carriedCount = currentChunk.length;
        currentSize = this.calculateChunkSize(currentChunk);
      }
    }

    if (currentChunk.length > carriedCount) {
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
