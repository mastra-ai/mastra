import { describe, expect, it } from 'vitest';

import { HTMLHeaderTransformer, HTMLSectionTransformer } from './html';

const HEADERS: [string, string][] = [['h1', 'Header 1']];

describe('HTMLHeaderTransformer', () => {
  it('writes the text under a header once, not once per level of nesting', () => {
    // `element.text` already holds every descendant's text, so taking it and
    // then recursing repeated the content: this used to come back as
    // "Hello world Hello world Hello  world world".
    const transformer = new HTMLHeaderTransformer({ headers: HEADERS });

    const docs = transformer.splitText({
      text: '<html><body><h1>Title</h1><div><p>Hello <b>world</b></p></div></body></html>',
    });

    expect(docs).toHaveLength(1);
    expect(docs[0]!.text.match(/Hello/g)).toHaveLength(1);
    expect(docs[0]!.text.match(/world/g)).toHaveLength(1);
  });

  it('keeps two sibling paragraphs apart', () => {
    const transformer = new HTMLHeaderTransformer({ headers: HEADERS });

    const docs = transformer.splitText({
      text: '<html><body><h1>Title</h1><div><p>first</p><p>second</p></div></body></html>',
    });

    expect(docs[0]!.text.replace(/\s+/g, ' ').trim()).toBe('first second');
  });

  it('adds no copy per level of nesting', () => {
    const transformer = new HTMLHeaderTransformer({ headers: HEADERS });
    const nested = '<div>'.repeat(6) + 'deep' + '</div>'.repeat(6);

    const docs = transformer.splitText({
      text: `<html><body><h1>Title</h1>${nested}</body></html>`,
    });

    // Each level used to add one more copy: six nested divs gave seven.
    expect(docs[0]!.text.match(/deep/g)).toHaveLength(1);
  });

  it('keeps the text of a leaf element', () => {
    const transformer = new HTMLHeaderTransformer({ headers: HEADERS });

    const docs = transformer.splitText({
      text: '<html><body><h1>Title</h1><p>only</p></body></html>',
    });

    expect(docs[0]!.text.trim()).toBe('only');
  });
});

describe('HTMLSectionTransformer', () => {
  it('writes the text under a section once', () => {
    const transformer = new HTMLSectionTransformer({ sections: HEADERS });

    const docs = transformer.splitText('<html><body><h1>Title</h1><div><p>Hello <b>world</b></p></div></body></html>');

    const text = docs.map(doc => doc.text).join(' ');
    expect(text.match(/Hello/g)).toHaveLength(1);
    expect(text.match(/world/g)).toHaveLength(1);
  });
});
