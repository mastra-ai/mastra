import { MastraDocument } from './document';
import { HTMLHeaderTransformer, HTMLSectionTransformer } from './html';

describe('HTMLHeaderTextSplitter', () => {
  let splitter: HTMLHeaderTransformer;

  beforeEach(() => {
    splitter = new HTMLHeaderTransformer([
      ['h1', 'Header 1'],
      ['h2', 'Header 2'],
      ['h3', 'Header 3'],
    ]);
  });

  it('should split HTML with headers correctly', async () => {
    const html = `
      <html>
        <body>
          <h1>Main Title</h1>
          <p>Main content.</p>
          <h2>Section 1</h2>
          <p>Section 1 content.</p>
          <h3>Subsection 1.1</h3>
          <p>Subsection content.</p>
        </body>
      </html>
    `;

    const docs = await splitter.splitText({ text: html });
    expect(docs.length).toBeGreaterThan(1);
    expect(docs?.[0]?.metadata()?.['Header 1']).toBe('Main Title');
    expect(docs?.[1]?.metadata()?.['Header 2']).toBe('Section 1');
  });

  it('should handle nested content', async () => {
    const html = `
      <html>
        <body>
          <h1>Title</h1>
          <div>
            <p>Nested content.</p>
            <div>
              <p>Deeply nested content.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const docs = await splitter.splitText({ text: html });
    const mainSection = docs.find(doc => doc.metadata()?.['Header 1'] === 'Title');
    expect(mainSection?.content()).toContain('Nested content');
    expect(mainSection?.content()).toContain('Deeply nested content');
  });

  it('should respect returnEachElement option', async () => {
    const splitterWithElements = new HTMLHeaderTransformer([['h1', 'Header 1']], true);

    const html = `
      <html>
        <body>
          <h1>Title</h1>
          <p>Paragraph 1</p>
          <h1>Title</h1>
          <p>Paragraph 2</p>
          <h1>Title</h1>
          <p>Paragraph 3</p>
        </body>
      </html>
    `;

    const docs = await splitterWithElements.splitText({ text: html });

    expect(docs.length).toBeGreaterThan(2);
    docs.forEach(doc => {
      expect(doc.metadata()?.['Header 1']).toBe('Title');
    });
  });
});

describe('HTMLSectionSplitter', () => {
  let splitter: HTMLSectionTransformer;

  beforeEach(() => {
    splitter = new HTMLSectionTransformer([
      ['h1', 'Header 1'],
      ['h2', 'Header 2'],
    ]);
  });

  it('should split HTML into sections', async () => {
    const html = `
      <html>
        <body>
          <h1>Document Title</h1>
          <p>Introduction text.</p>
          <h2>First Section</h2>
          <p>First section content.</p>
          <h2>Second Section</h2>
          <p>Second section content.</p>
        </body>
      </html>
    `;

    const docs = await splitter.splitText(html);
    expect(docs.length).toBe(3);
    expect(docs?.[0]?.metadata()?.['Header 1']).toBe('Document Title');
    expect(docs?.[1]?.metadata()?.['Header 2']).toBe('First Section');
  });

  it('should properly merge metadata', async () => {
    const docs = [
      new MastraDocument({
        text: `
          <h1>Title 1</h1>
          <p>Content 1</p>
        `,
        metadata: { source: 'doc1' },
      }),
      new MastraDocument({
        text: `
          <h1>Title 2</h1>
          <p>Content 2</p>
        `,
        metadata: { source: 'doc2' },
      }),
    ].map(doc => doc);

    const results = await splitter.splitDocuments(docs);

    results.forEach(doc => {
      expect(doc?.metadata()).toHaveProperty('source');
      expect(doc?.metadata()).toHaveProperty('Header 1');
    });
  });
});
