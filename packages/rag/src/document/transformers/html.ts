import { Document } from 'llamaindex';
import { parse } from 'node-html-parser';

import { RecursiveCharacterTransformer } from './character';

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

  splitText({ text }: { text: string }): Document[] {
    const root = parse(text);

    const headerFilter = this.headersToSplitOn.map(([header]) => header);
    const headerMapping = Object.fromEntries(this.headersToSplitOn);

    const elements: ElementType[] = [];
    const headers = root.querySelectorAll(headerFilter.join(','));

    headers.forEach(header => {
      let content = '';
      let nextElement = header.nextElementSibling;

      while (nextElement && !headerFilter.includes(nextElement.rawTagName.toLowerCase())) {
        content += nextElement.textContent + ' ';
        nextElement = nextElement.nextElementSibling;
      }

      elements.push({
        url: text,
        xpath: this.getXPath(header),
        content: content.trim(),
        metadata: {
          [headerMapping?.[header.rawTagName.toLowerCase()]!]: header.textContent?.trim() || '',
        },
      });
    });

    return this.returnEachElement
      ? elements.map(
          el =>
            new Document({
              text: el.content,
              metadata: el.metadata,
            }),
        )
      : this.aggregateElementsToChunks(elements);
  }

  private getXPath(element: any): string {
    const parts: string[] = [];
    let current = element;

    while (current && current.nodeType === 1) {
      let index = 1;
      let sibling = current.previousElementSibling;

      while (sibling) {
        if (sibling.rawTagName === current.rawTagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }

      if (current.rawTagName) {
        parts.unshift(`${current.rawTagName.toLowerCase()}[${index}]`);
      }
      current = current.parentNode;
    }

    return '/' + parts.join('/');
  }

  private aggregateElementsToChunks(elements: ElementType[]): Document[] {
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
        new Document({
          text: chunk.content,
          metadata: chunk.metadata,
        }),
    );
  }

  createDocuments(texts: string[], metadatas?: Record<string, any>[]): Document[] {
    const _metadatas = metadatas || Array(texts.length).fill({});
    const documents: Document[] = [];

    for (let i = 0; i < texts.length; i++) {
      const chunks = this.splitText({ text: texts[i]! });
      for (const chunk of chunks) {
        const metadata = { ...(_metadatas[i] || {}) };

        const chunkMetadata = chunk.metadata;

        if (chunkMetadata) {
          for (const [key, value] of Object.entries(chunkMetadata || {})) {
            if (value === '#TITLE#') {
              chunkMetadata[key] = metadata['Title'];
            }
          }
        }

        documents.push(
          new Document({
            text: chunk.text!,
            metadata: { ...metadata, ...chunkMetadata },
          }),
        );
      }
    }

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

export class HTMLSectionTransformer {
  private headersToSplitOn: Record<string, string>;
  private options: Record<string, any>;

  constructor(headersToSplitOn: [string, string][], options: Record<string, any> = {}) {
    this.headersToSplitOn = Object.fromEntries(headersToSplitOn);
    this.options = options;
  }

  splitText(text: string): Document[] {
    const sections = this.splitHtmlByHeaders(text);

    return sections.map(
      section =>
        new Document({
          text: section.content,
          metadata: {
            [this.headersToSplitOn[section.tagName]!]: section.header,
          },
        }),
    );
  }

  private splitHtmlByHeaders(htmlDoc: string): Array<{
    header: string;
    content: string;
    tagName: string;
  }> {
    const sections: Array<{
      header: string;
      content: string;
      tagName: string;
    }> = [];

    const root = parse(htmlDoc);
    const headers = Object.keys(this.headersToSplitOn);
    const headerElements = root.querySelectorAll(headers.join(','));

    headerElements.forEach((headerElement, index) => {
      const header = headerElement.textContent?.trim() || '';
      const tagName = headerElement.rawTagName.toLowerCase();
      let content = '';

      let currentElement = headerElement.nextElementSibling;
      const nextHeader = headerElements[index + 1];

      while (currentElement && (!nextHeader || currentElement !== nextHeader)) {
        if (currentElement.textContent) {
          content += currentElement.textContent.trim() + ' ';
        }
        currentElement = currentElement.nextElementSibling;
      }

      content = content.trim();
      sections.push({
        header,
        content,
        tagName,
      });
    });

    return sections;
  }

  async splitDocuments(documents: Document[]): Promise<Document[]> {
    const texts: string[] = [];
    const metadatas: Record<string, any>[] = [];

    for (const doc of documents) {
      texts.push(doc.text);
      metadatas.push(doc.metadata);
    }
    const results = await this.createDocuments(texts, metadatas);
    const textSplitter = new RecursiveCharacterTransformer({ options: this.options });

    return textSplitter.splitDocuments(results);
  }

  createDocuments(texts: string[], metadatas?: Record<string, any>[]): Document[] {
    const _metadatas = metadatas || Array(texts.length).fill({});
    const documents: Document[] = [];

    for (let i = 0; i < texts.length; i++) {
      const chunks = this.splitText(texts[i]!);
      for (const chunk of chunks) {
        const metadata = { ...(_metadatas[i] || {}) };

        const chunkMetadata = chunk.metadata;

        if (chunkMetadata) {
          for (const [key, value] of Object.entries(chunkMetadata || {})) {
            if (value === '#TITLE#') {
              chunkMetadata[key] = metadata['Title'];
            }
          }
        }

        documents.push(
          new Document({
            text: chunk.text!,
            metadata: { ...metadata, ...chunkMetadata },
          }),
        );
      }
    }

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
