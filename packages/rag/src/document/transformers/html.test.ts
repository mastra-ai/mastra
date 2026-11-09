import { describe, expect, it } from 'vitest';
import { MDocument } from '../document';

const chunkBoth = async (html: string) => ({
  headers: (await MDocument.fromHTML(html).chunk({ strategy: 'html', headers: [['h1', 'Header 1']] })).map(c => c.text),
  sections: (await MDocument.fromHTML(html).chunk({ strategy: 'html', sections: [['h1', 'Header 1']] })).map(
    c => c.text,
  ),
});

describe('HTML transformers text extraction', () => {
  it.each([
    ['<h1>Intro</h1><p>Hello <b>world</b></p><ul><li>One</li><li>Two</li></ul>', 'Hello world One Two'],
    ['<h1>Intro</h1><p>Plain paragraph</p>', 'Plain paragraph'],
    ['<h1>Intro</h1><div><div><p>x</p></div></div>', 'x'],
    ['<h1>Intro</h1><p>Hel<b>lo</b></p>', 'Hello'],
    ['<h1>Intro</h1><fieldset><legend>Name</legend>Bob</fieldset>', 'Name Bob'],
    [
      '<h1>Intro</h1><div><details><summary>First</summary></details><details><summary>Second</summary></details></div>',
      'First Second',
    ],
  ])('extracts each piece of text once: %s', async (html, expected) => {
    const { headers, sections } = await chunkBoth(html);
    expect(headers).toEqual([expected]);
    expect(sections).toEqual([expected]);
  });
});
