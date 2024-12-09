import { RecursiveCharacterTextSplitter, Language, Document as MDocument } from './transformer';

interface LineType {
  metadata: Record<string, string>;
  content: string;
}

interface HeaderType {
  level: number;
  name: string;
  data: string;
}

export class MarkdownTextSplitter extends RecursiveCharacterTextSplitter {
  constructor(
    options: {
      chunkSize?: number;
      chunkOverlap?: number;
      lengthFunction?: (text: string) => number;
      keepSeparator?: boolean | 'start' | 'end';
      addStartIndex?: boolean;
      stripWhitespace?: boolean;
    } = {},
  ) {
    const separators = RecursiveCharacterTextSplitter.getSeparatorsForLanguage(Language.MARKDOWN);
    super(separators, true, options);
  }
}

export class MarkdownHeaderTextSplitter {
  private headersToSplitOn: [string, string][];
  private returnEachLine: boolean;
  private stripHeaders: boolean;

  constructor(headersToSplitOn: [string, string][], returnEachLine: boolean = false, stripHeaders: boolean = true) {
    this.headersToSplitOn = [...headersToSplitOn].sort((a, b) => b[0].length - a[0].length);
    this.returnEachLine = returnEachLine;
    this.stripHeaders = stripHeaders;
  }

  private aggregateLinesToChunks(lines: LineType[]): MDocument[] {
    // If returnEachLine is true, create a document for each non-empty line
    if (this.returnEachLine) {
      return lines.flatMap(line => {
        // Split the content into lines
        const contentLines = line.content.split('\n');
        // Filter out empty lines but preserve header lines regardless of stripHeaders
        return contentLines
          .filter(l => l.trim() !== '' || this.headersToSplitOn.some(([sep]) => l.trim().startsWith(sep)))
          .map(l => ({
            pageContent: l.trim(),
            metadata: line.metadata,
          }));
      });
    }

    const aggregatedChunks: LineType[] = [];

    for (const line of lines) {
      if (
        aggregatedChunks.length > 0 &&
        JSON.stringify(aggregatedChunks?.[aggregatedChunks.length - 1]!.metadata) === JSON.stringify(line.metadata)
      ) {
        const aggChunk = aggregatedChunks[aggregatedChunks.length - 1];
        // If the last line has the same metadata, append the content
        aggChunk!.content += '  \n' + line.content;
      } else if (
        aggregatedChunks.length > 0 &&
        JSON.stringify(aggregatedChunks?.[aggregatedChunks.length - 1]!.metadata) !== JSON.stringify(line.metadata) &&
        Object.keys(aggregatedChunks?.[aggregatedChunks.length - 1]!.metadata).length <
          Object.keys(line.metadata).length &&
        aggregatedChunks?.[aggregatedChunks.length - 1]?.content?.split('\n')?.slice(-1)[0]![0] === '#' &&
        !this.stripHeaders
      ) {
        if (aggregatedChunks && aggregatedChunks?.[aggregatedChunks.length - 1]) {
          const aggChunk = aggregatedChunks[aggregatedChunks.length - 1];
          // Handle nested headers
          if (aggChunk) {
            aggChunk.content += '  \n' + line.content;
            aggChunk.metadata = line.metadata;
          }
        }
      } else {
        aggregatedChunks.push(line);
      }
    }

    return aggregatedChunks.map(chunk => ({
      pageContent: chunk.content,
      metadata: chunk.metadata,
    }));
  }

  splitText(text: string): MDocument[] {
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

          // Always create a separate chunk for the header
          linesWithMetadata.push({
            content: line,
            metadata: { ...currentMetadata, ...initialMetadata },
          });

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
}
