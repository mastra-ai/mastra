import { MarkdownTransformer, MarkdownHeaderTransformer } from './markdown';

describe('MarkdownTransformer', () => {
  let splitter: MarkdownTransformer;

  beforeEach(() => {
    splitter = new MarkdownTransformer({
      chunkSize: 100,
      chunkOverlap: 10,
    });
  });

  it('should split markdown text correctly', () => {
    const text = `# Header 1
      
  This is some text under header 1.
  
  ## Header 2
  
  This is some text under header 2.
  
  ### Header 3
  
  - List item 1
  - List item 2`;

    const chunks = splitter.splitText({ text });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain('# Header 1');
  });

  it('should handle code blocks', () => {
    const text = `# Code Example
  
  \`\`\`javascript
  function hello() {
    console.log('Hello, World!');
  }
  \`\`\`
  
  Regular text after code block.`;

    const chunks = splitter.splitText({ text });
    expect(chunks.some(chunk => chunk.includes('```javascript'))).toBe(true);
  });
});

describe('MarkdownHeaderTransformer', () => {
  let splitter: MarkdownHeaderTransformer;

  beforeEach(() => {
    splitter = new MarkdownHeaderTransformer([
      ['#', 'Header 1'],
      ['##', 'Header 2'],
      ['###', 'Header 3'],
    ]);
  });

  it('should split on headers and preserve metadata', () => {
    const text = `# Main Title
  
  Some content here.
  
  ## Section 1
  
  Section 1 content.
  
  ### Subsection 1.1
  
  Subsection content.
  
  ## Section 2
  
  Final content.`;

    const docs = splitter.splitText({ text });

    expect(docs.length).toBeGreaterThan(1);
    expect(docs?.[0]?.metadata()?.['Header 1']).toBe('Main Title');

    const section1 = docs.find(doc => doc?.metadata()?.['Header 2'] === 'Section 1');
    expect(section1).toBeDefined();
    expect(section1?.content()).toContain('Section 1 content');
  });

  it('should handle nested headers correctly', () => {
    const text = `# Top Level
  
  ## Section A
  Content A
  
  ### Subsection A1
  Content A1
  
  ## Section B
  Content B`;

    const docs = splitter.splitText({ text });

    const subsectionDoc = docs.find(doc => doc?.metadata()?.['Header 3'] === 'Subsection A1');
    expect(subsectionDoc).toBeDefined();
    expect(subsectionDoc?.metadata()?.['Header 1']).toBe('Top Level');
    expect(subsectionDoc?.metadata()?.['Header 2']).toBe('Section A');
  });

  it('should handle code blocks without splitting them', () => {
    const text = `# Code Section
  
  \`\`\`python
  def hello():
      print("Hello World")
  \`\`\`
  
  ## Next Section`;

    const docs = splitter.splitText({ text });
    const codeDoc = docs.find(doc => doc?.content()?.includes('```python'));
    expect(codeDoc?.content()).toContain('print("Hello World")');
  });

  it('should respect returnEachLine option', () => {
    const splitterWithLines = new MarkdownHeaderTransformer([['#', 'Header 1']], true);

    const text = `# Title
  
  Line 1
  Line 2
  Line 3`;

    const docs = splitterWithLines.splitText({ text });
    expect(docs.length).toBe(4); // Title + 3 lines
    docs.slice(1).forEach(doc => {
      expect(doc.metadata()?.['Header 1']).toBe('Title');
    });
  });

  it('should handle stripHeaders option', () => {
    const splitterWithHeaders = new MarkdownHeaderTransformer([['#', 'Header 1']], false, false);

    const text = `# Title
  
  Content`;

    const docs = splitterWithHeaders.splitText({ text });
    expect(docs?.[0]?.content()).toContain('# Title');
  });
});
