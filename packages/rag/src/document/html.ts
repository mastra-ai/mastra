import { JSDOM } from 'jsdom';

import { RecursiveCharacterTransformer } from './character';
import { MastraDocument } from './document';

interface ElementType {
  url: string;
  xpath: string;
  content: string;
  metadata: Record<string, string>;
}

export class HTMLHeaderTransformer {
  private headersToSplitOn: [string, string][];
  private returnEachElement: boolean;

  constructor(headersToSplitOn: [string, string][], returnEachElement: boolean = false) {
    this.returnEachElement = returnEachElement;
    this.headersToSplitOn = [...headersToSplitOn].sort();
  }

  async splitText({ text }: { text: string }): Promise<MastraDocument[]> {
    const dom = new JSDOM(text);
    const { document } = dom.window;

    const headerFilter = this.headersToSplitOn.map(([header]) => header);
    const headerMapping = Object.fromEntries(this.headersToSplitOn);

    const elements: ElementType[] = [];
    const headers = document.querySelectorAll(headerFilter.join(','));

    headers.forEach(header => {
      let content = '';
      let nextElement = header.nextElementSibling;

      while (nextElement && !headerFilter.includes(nextElement.tagName.toLowerCase())) {
        content += nextElement.textContent + ' ';
        nextElement = nextElement.nextElementSibling;
      }

      elements.push({
        url: text,
        xpath: this.getXPath(header),
        content: content.trim(),
        metadata: {
          [headerMapping?.[header.tagName.toLowerCase()]!]: header.textContent?.trim() || '',
        },
      });
    });

    return this.returnEachElement
      ? elements.map(
          el =>
            new MastraDocument({
              text: el.content,
              metadata: el.metadata,
            }),
        )
      : this.aggregateElementsToChunks(elements);
  }

  private getXPath(element: Element): string {
    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current.nodeType === 1) {
      let index = 1;
      for (let sibling = current.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
        if (sibling.nodeName === current.nodeName) {
          index++;
        }
      }
      parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
      current = current.parentElement;
    }

    return '/' + parts.join('/');
  }

  private aggregateElementsToChunks(elements: ElementType[]): MastraDocument[] {
    const aggregatedChunks: ElementType[] = [];

    for (const element of elements) {
      if (
        aggregatedChunks.length > 0 &&
        JSON.stringify(aggregatedChunks[aggregatedChunks.length - 1]!.metadata) === JSON.stringify(element.metadata)
      ) {
        // If the last element has the same metadata, append content
        aggregatedChunks[aggregatedChunks.length - 1]!.content += '  \n' + element.content;
      } else {
        // Otherwise, add as new element
        aggregatedChunks.push({ ...element });
      }
    }

    return aggregatedChunks.map(
      chunk =>
        new MastraDocument({
          text: chunk.content,
          metadata: chunk.metadata,
        }),
    );
  }
}

export class HTMLSectionTransformer {
  private headersToSplitOn: Record<string, string>;
  private options: Record<string, any>;

  constructor(headersToSplitOn: [string, string][], options: Record<string, any> = {}) {
    this.headersToSplitOn = Object.fromEntries(headersToSplitOn);
    this.options = options;
  }

  async splitText(text: string): Promise<MastraDocument[]> {
    const sections = await this.splitHtmlByHeaders(text);

    return sections.map(
      section =>
        new MastraDocument({
          text: section.content,
          metadata: {
            [this.headersToSplitOn[section.tagName]!]: section.header,
          },
        }),
    );
  }

  async splitDocuments(documents: MastraDocument[]): Promise<MastraDocument[]> {
    const texts: string[] = [];
    const metadatas: Record<string, any>[] = [];

    for (const doc of documents) {
      doc.documents?.forEach(doc => {
        texts.push(doc.text);
        metadatas.push(doc.metadata);
      });
    }
    const results = await this.createDocuments(texts, metadatas);
    const textSplitter = new RecursiveCharacterTransformer({ options: this.options });

    return textSplitter.splitDocuments(results);
  }

  async createDocuments(texts: string[], metadatas?: Record<string, any>[]): Promise<MastraDocument[]> {
    const _metadatas = metadatas || Array(texts.length).fill({});
    const documents: MastraDocument[] = [];

    for (let i = 0; i < texts.length; i++) {
      const chunks = await this.splitText(texts[i]!);
      for (const chunk of chunks) {
        const metadata = { ...(_metadatas[i] || {}) };

        const chunkMetadata = chunk.metadata();

        if (chunkMetadata) {
          for (const [key, value] of Object.entries(chunkMetadata || {})) {
            if (value === '#TITLE#') {
              chunkMetadata[key] = metadata['Title'];
            }
          }
        }

        documents.push(
          new MastraDocument({
            text: chunk.content()!,
            metadata: { ...metadata, ...chunkMetadata },
          }),
        );
      }
    }

    return documents;
  }

  private async splitHtmlByHeaders(htmlDoc: string): Promise<
    Array<{
      header: string;
      content: string;
      tagName: string;
    }>
  > {
    const sections: Array<{
      header: string;
      content: string;
      tagName: string;
    }> = [];

    const dom = new JSDOM(htmlDoc);
    const { document } = dom.window;
    const headers = ['body', ...Object.keys(this.headersToSplitOn)];

    const headerElements = Array.from(document.querySelectorAll(headers.join(',')));

    for (let i = 0; i < headerElements.length; i++) {
      const headerElement = headerElements[i]!;
      let currentHeader: string;
      let currentHeaderTag: string;
      let sectionContent: string[] = [];

      if (i === 0) {
        currentHeader = '#TITLE#';
        currentHeaderTag = 'h1';
      } else {
        currentHeader = headerElement.textContent?.trim() || '';
        currentHeaderTag = headerElement.tagName.toLowerCase();
      }

      // Get content until next header
      let currentNode = headerElement.nextSibling;
      const nextHeader = headerElements[i + 1];

      while (currentNode && currentNode !== nextHeader) {
        if (currentNode.textContent) {
          sectionContent.push(currentNode.textContent);
        }
        currentNode = currentNode.nextSibling;
      }

      const content = sectionContent.join(' ').trim();
      if (content) {
        sections.push({
          header: currentHeader,
          content,
          tagName: currentHeaderTag,
        });
      }
    }

    return sections;
  }
}
