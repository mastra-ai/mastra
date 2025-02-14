import { Document } from 'llamaindex';
import { parse } from 'node-html-better-parser';

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
      const parentNode = header.parentNode;

      if (parentNode && parentNode.childNodes) {
        let foundHeader = false;
        for (const node of parentNode.childNodes) {
          // Start collecting content after we find our header
          if (node === header) {
            foundHeader = true;
            continue;
          }

          // If we found our header and hit another header, stop
          // @ts-expect-error - node.tagName is not defined on type Node
          if (foundHeader && node.tagName && headerFilter.includes(node.tagName.toLowerCase())) {
            break;
          }

          // Collect content between headers
          if (foundHeader) {
            content += this.getTextContent(node) + ' ';
          }
        }
      }

      elements.push({
        url: text,
        xpath: this.getXPath(header),
        content: content.trim(),
        metadata: {
          [headerMapping?.[header.tagName.toLowerCase()]!]: header.text || '',
        },
      });
    });

    return this.returnEachElement
      ? elements.map(
          el =>
            new Document({
              text: el.content,
              metadata: { ...el.metadata, xpath: el.xpath },
            }),
        )
      : this.aggregateElementsToChunks(elements);
  }

  private getXPath(element: any): string {
    if (!element) return '';

    const parts: string[] = [];
    let current = element;

    while (current && current.tagName) {
      let index = 1;
      const parent = current.parentNode;

      if (parent && parent.childNodes) {
        // Count preceding siblings with same tag
        for (const sibling of parent.childNodes) {
          if (sibling === current) break;
          if (sibling.tagName === current.tagName) {
            index++;
          }
        }
      }

      parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
      current = current.parentNode;
    }

    return '/' + parts.join('/');
  }

  private getTextContent(element: any): string {
    if (!element) return '';

    // For text nodes, return their content
    if (!element.tagName) {
      return element.text || '';
    }

    // For element nodes, combine their text with children's text
    let content = element.text || '';

    if (element.childNodes) {
      for (const child of element.childNodes) {
        const childText = this.getTextContent(child);
        if (childText) {
          content += ' ' + childText;
        }
      }
    }

    return content.trim();
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
          metadata: { ...chunk.metadata, xpath: chunk.xpath },
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
    this.headersToSplitOn = Object.fromEntries(headersToSplitOn.map(([tag, name]) => [tag.toLowerCase(), name]));
    this.options = options;
  }

  splitText(text: string): Document[] {
    const sections = this.splitHtmlByHeaders(text);

    return sections.map(
      section =>
        new Document({
          text: section.content,
          metadata: {
            [this.headersToSplitOn[section.tagName.toLowerCase()]!]: section.header,
            xpath: section.xpath,
          },
        }),
    );
  }

  private getXPath(element: any): string {
    const parts: string[] = [];
    let current = element;

    while (current && current.nodeType === 1) {
      let index = 1;
      let sibling = current.previousSibling;

      while (sibling) {
        if (sibling.nodeType === 1 && sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }

      if (current.tagName) {
        parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
      }
      current = current.parentNode;
    }

    return '/' + parts.join('/');
  }

  private splitHtmlByHeaders(htmlDoc: string): Array<{
    header: string;
    content: string;
    tagName: string;
    xpath: string;
  }> {
    const sections: Array<{
      header: string;
      content: string;
      tagName: string;
      xpath: string;
    }> = [];

    const root = parse(htmlDoc);
    const headers = Object.keys(this.headersToSplitOn);
    const headerElements = root.querySelectorAll(headers.join(','));

    headerElements.forEach((headerElement, index) => {
      const header = headerElement.text?.trim() || '';
      const tagName = headerElement.tagName;
      const xpath = this.getXPath(headerElement);
      let content = '';

      // @ts-expect-error - nextElementSibling is not defined on type Element
      let currentElement = headerElement.nextElementSibling;
      const nextHeader = headerElements[index + 1];

      while (currentElement && (!nextHeader || currentElement !== nextHeader)) {
        if (currentElement.text) {
          content += currentElement.text.trim() + ' ';
        }
        currentElement = currentElement.nextElementSibling;
      }

      content = content.trim();
      sections.push({
        header,
        content,
        tagName,
        xpath,
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
