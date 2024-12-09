import { JSDOM } from 'jsdom';

import { Document as MDocument } from './transformer';
import { RecursiveCharacterTextSplitter } from './transformer';

interface ElementType {
  url: string;
  xpath: string;
  content: string;
  metadata: Record<string, string>;
}

export class HTMLHeaderTextSplitter {
  private headersToSplitOn: [string, string][];
  private returnEachElement: boolean;

  constructor(headersToSplitOn: [string, string][], returnEachElement: boolean = false) {
    this.returnEachElement = returnEachElement;
    this.headersToSplitOn = [...headersToSplitOn].sort();
  }

  async splitText(text: string): Promise<MDocument[]> {
    const dom = new JSDOM(text);
    const { document } = dom.window;

    // Create filter and mapping for header metadata
    const headerFilter = this.headersToSplitOn.map(([header]) => header);
    const headerMapping = Object.fromEntries(this.headersToSplitOn);

    // Process elements
    const elements: ElementType[] = [];
    const headers = document.querySelectorAll(headerFilter.join(','));

    headers.forEach(header => {
      let content = '';
      let nextElement = header.nextElementSibling;

      // Collect content until next header
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
      ? elements.map(el => ({
          pageContent: el.content,
          metadata: el.metadata,
        }))
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

  private aggregateElementsToChunks(elements: ElementType[]): MDocument[] {
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

    return aggregatedChunks.map(chunk => ({
      pageContent: chunk.content,
      metadata: chunk.metadata,
    }));
  }
}

export class HTMLSectionSplitter {
  private headersToSplitOn: Record<string, string>;
  private options: Record<string, any>;

  constructor(headersToSplitOn: [string, string][], options: Record<string, any> = {}) {
    this.headersToSplitOn = Object.fromEntries(headersToSplitOn);
    this.options = options;
  }

  async splitText(text: string): Promise<MDocument[]> {
    const sections = await this.splitHtmlByHeaders(text);

    return sections.map(section => ({
      pageContent: section.content,
      metadata: {
        [this.headersToSplitOn[section.tagName]!]: section.header,
      },
    }));
  }

  async splitDocuments(documents: MDocument[]): Promise<MDocument[]> {
    const texts: string[] = [];
    const metadatas: Record<string, any>[] = [];

    for (const doc of documents) {
      texts.push(doc.pageContent);
      metadatas.push(doc.metadata);
    }

    const results = await this.createDocuments(texts, metadatas);
    const textSplitter = new RecursiveCharacterTextSplitter(undefined, false, this.options);

    return textSplitter.splitDocuments(results);
  }

  async createDocuments(texts: string[], metadatas?: Record<string, any>[]): Promise<MDocument[]> {
    const _metadatas = metadatas || Array(texts.length).fill({});
    const documents: MDocument[] = [];

    for (let i = 0; i < texts.length; i++) {
      const chunks = await this.splitText(texts[i]!);
      for (const chunk of chunks) {
        const metadata = { ...(_metadatas[i] || {}) };

        for (const [key, value] of Object.entries(chunk.metadata)) {
          if (value === '#TITLE#') {
            chunk.metadata[key] = metadata['Title'];
          }
        }

        const newDoc = {
          pageContent: chunk.pageContent,
          metadata: { ...metadata, ...chunk.metadata },
        };
        documents.push(newDoc);
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
