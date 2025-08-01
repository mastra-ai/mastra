import { Document } from '../schema';

import { Language } from '../types';
import type { BaseChunkOptions } from '../types';

import { RecursiveCharacterTransformer } from './character';

interface LineType {
  metadata: Record<string, string>;
  content: string;
}

interface HeaderType {
  level: number;
  name: string;
  data: string;
}

export class MarkdownTransformer extends RecursiveCharacterTransformer {
  constructor(options: BaseChunkOptions = {}) {
    const separators = RecursiveCharacterTransformer.getSeparatorsForLanguage(Language.MARKDOWN);
    super({ ...options, separators, isSeparatorRegex: true });
  }
}

export class MarkdownHeaderTransformer {
  private headersToSplitOn: [string, string][];
  private returnEachLine: boolean;
  private stripHeaders: boolean;

  constructor(headersToSplitOn: [string, string][], returnEachLine: boolean = false, stripHeaders: boolean = true) {
    this.headersToSplitOn = [...headersToSplitOn].sort((a, b) => b[0].length - a[0].length);
    this.returnEachLine = returnEachLine;
    this.stripHeaders = stripHeaders;
  }

  private aggregateLinesToChunks(lines: LineType[]): Document[] {
    if (this.returnEachLine) {
      return lines.flatMap(line => {
        const contentLines = line.content.split('\n');
        return contentLines
          .filter(l => l.trim() !== '' || this.headersToSplitOn.some(([sep]) => l.trim().startsWith(sep)))
          .map(
            l =>
              new Document({
                text: l.trim(),
                metadata: line.metadata,
              }),
          );
      });
    }

    const aggregatedChunks: LineType[] = [];

    for (const line of lines) {
      const lastLine = aggregatedChunks[aggregatedChunks.length - 1]?.content?.split('\n')?.slice(-1)[0]?.trim();
      const lastChunkIsHeader = lastLine ? this.headersToSplitOn.some(([sep]) => lastLine.startsWith(sep)) : false;
      if (
        aggregatedChunks.length > 0 &&
        JSON.stringify(aggregatedChunks?.[aggregatedChunks.length - 1]!.metadata) === JSON.stringify(line.metadata)
      ) {
        const aggChunk = aggregatedChunks[aggregatedChunks.length - 1];
        aggChunk!.content += '  \n' + line.content;
      } else if (
        aggregatedChunks.length > 0 &&
        JSON.stringify(aggregatedChunks?.[aggregatedChunks.length - 1]!.metadata) !== JSON.stringify(line.metadata) &&
        Object.keys(aggregatedChunks?.[aggregatedChunks.length - 1]!.metadata).length <
          Object.keys(line.metadata).length &&
        lastChunkIsHeader
      ) {
        if (aggregatedChunks && aggregatedChunks?.[aggregatedChunks.length - 1]) {
          const aggChunk = aggregatedChunks[aggregatedChunks.length - 1];
          if (aggChunk) {
            aggChunk.content += '  \n' + line.content;
            aggChunk.metadata = line.metadata;
          }
        }
      } else {
        aggregatedChunks.push(line);
      }
    }

    return aggregatedChunks.map(
      chunk =>
        new Document({
          text: chunk.content,
          metadata: chunk.metadata,
        }),
    );
  }

  splitText({ text }: { text: string }): Document[] {
    const lines = text.split('\n');
    const linesWithMetadata: LineType[] = [];
    let currentContent: string[] = [];
    let currentMetadata: Record<string, string> = {};
    const headerStack: HeaderType[] = [];
    const initialMetadata: Record<string, string> = {};

    let inCodeBlock = false;
    let openingFence = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const strippedLine = line.trim();

      if (!inCodeBlock) {
        if (
          (strippedLine.startsWith('```') && strippedLine.split('```').length === 2) ||
          strippedLine.startsWith('~~~')
        ) {
          inCodeBlock = true;
          openingFence = strippedLine.startsWith('```') ? '```' : '~~~';
        }
      } else {
        if (strippedLine.startsWith(openingFence)) {
          inCodeBlock = false;
          openingFence = '';
        }
      }

      if (inCodeBlock) {
        currentContent.push(line);
        continue;
      }

      let headerMatched = false;
      for (const [sep, name] of this.headersToSplitOn) {
        if (strippedLine.startsWith(sep) && (strippedLine.length === sep.length || strippedLine[sep.length] === ' ')) {
          headerMatched = true;

          // If we have existing content, save it before processing the header
          if (currentContent.length > 0) {
            linesWithMetadata.push({
              content: currentContent.join('\n'),
              metadata: { ...currentMetadata },
            });
            currentContent = [];
          }

          if (name !== null) {
            const currentHeaderLevel = (sep.match(/#/g) || []).length;

            // Pop headers of lower or same level
            while (headerStack.length > 0 && headerStack?.[headerStack.length - 1]!.level >= currentHeaderLevel) {
              const poppedHeader = headerStack.pop()!;
              if (poppedHeader.name in initialMetadata) {
                delete initialMetadata[poppedHeader.name];
              }
            }

            // Push current header
            const header: HeaderType = {
              level: currentHeaderLevel,
              name,
              data: strippedLine.slice(sep.length).trim(),
            };
            headerStack.push(header);
            initialMetadata[name] = header.data;
          }

          // Only add header to linesWithMetadata if stripHeaders is false
          if (!this.stripHeaders) {
            linesWithMetadata.push({
              content: line,
              metadata: { ...currentMetadata, ...initialMetadata },
            });
          }
          break;
        }
      }

      if (!headerMatched) {
        if (strippedLine || this.returnEachLine) {
          currentContent.push(line);

          if (this.returnEachLine) {
            // In returnEachLine mode, flush each non-header line immediately
            linesWithMetadata.push({
              content: line,
              metadata: { ...currentMetadata },
            });
            currentContent = [];
          }
        } else if (currentContent.length > 0) {
          linesWithMetadata.push({
            content: currentContent.join('\n'),
            metadata: { ...currentMetadata },
          });
          currentContent = [];
        }
      }

      // Reset metadata for next line
      currentMetadata = { ...initialMetadata };
    }

    // Handle any remaining content
    if (currentContent.length > 0) {
      linesWithMetadata.push({
        content: currentContent.join('\n'),
        metadata: currentMetadata,
      });
    }

    return this.aggregateLinesToChunks(linesWithMetadata);
  }

  createDocuments(texts: string[], metadatas?: Record<string, any>[]): Document[] {
    const _metadatas = metadatas || Array(texts.length).fill({});
    const documents: Document[] = [];

    texts.forEach((text, i) => {
      this.splitText({ text }).forEach(chunk => {
        const metadata = { ..._metadatas[i], ...chunk.metadata };
        documents.push(
          new Document({
            text: chunk.text,
            metadata,
          }),
        );
      });
    });

    return documents;
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
