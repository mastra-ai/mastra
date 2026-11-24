// @vitest-environment jsdom
import type { Root } from 'mdast';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { describe, expect, it } from 'vitest';

import { MarkdownRenderer } from './markdown-renderer';

// The built-in code and link elements carry their own chrome, so both sides draw
// them the same plain way and only the markdown itself can differ.
const PLAIN: Components = {
  pre: ({ node: _node, ...props }) => <pre {...props} />,
  a: ({ node: _node, ...props }) => <a {...props} />,
};

const whole = (markdown: string) =>
  renderToStaticMarkup(
    <div className="mastra-markdown">
      <Markdown remarkPlugins={[remarkGfm]} components={PLAIN}>
        {markdown}
      </Markdown>
    </div>,
  );

const rendered = (markdown: string) =>
  renderToStaticMarkup(<MarkdownRenderer components={PLAIN}>{markdown}</MarkdownRenderer>);

describe('MarkdownRenderer lists', () => {
  it.each([
    ['a tight bullet list', '- one\n- two\n- three'],
    ['a numbered list that starts at three with parentheses', '3) three\n4) four\n5) five'],
    ['a numbered list that starts at zero', '0. zero\n1. one\n2. two'],
    ['a list whose items are spaced out', '1. one\n\n2. two\n\n3. three'],
    ['a tight list that turns loose further down', '- a\n- b\n\n- c\n- d'],
    ['an item with a second paragraph in a spaced list', '1. one\n\n   still one\n\n2. two'],
    ['an item with a second paragraph in an otherwise tight list', '- one\n\n  still one\n- two\n- three'],
    ['nested lists', '- a\n  - a1\n  - a2\n- b\n  1. b1\n  2. b2\n- c'],
    ['a spaced nested list inside a tight one', '- a\n  - a1\n\n  - a2\n- b\n- c'],
    ['a blank line closing a nested list before the next item', '- a\n  - a1\n\n- b\n- c'],
    [
      'a fence holding a blank line inside a tight list',
      '- run:\n  ```sh\n  npm i\n\n  npm test\n  ```\n- done\n- after',
    ],
    ['a fence inside a spaced list', '1. run:\n\n   ```sh\n   npm i\n   ```\n\n2. done\n\n3. after'],
    ['a fence the next item cuts short', '- ```\n  code\n- next\n- last'],
    ['a fence the next item cuts short after a blank line', '- ```\n  code\n\n- next\n- last'],
    ['a fence opened by a nested item, before a blank line', '- a\n  - ```\n    code\n\n- b\n- c'],
    ['a fence whose info string holds a backtick', '- ``` a`b\n  ```\n\n- b\n- c'],
    ['raw HTML holding a blank line', '- <pre>\n  x\n\n  y\n  </pre>\n- b\n- c'],
    ['an HTML comment before the next item', '- a <!--\n  <!-- note\n\n- b\n- c'],
    ['raw HTML opened by a nested item, before a blank line', '- a\n  - <pre>\n    x\n\n- b\n- c'],
    ['an HTML comment opened in a nested quote, before a blank line', '- a\n  > <!-- c\n\n- b\n- c'],
    ['a quote closing an item before a spaced one', '- > quote\n\n- b\n- c'],
    ['a table closing an item before a spaced one', '- | a |\n  | - |\n  | 1 |\n\n- b\n- c'],
    ['indented code closing an item before a spaced one', '- a\n\n      code\n\n- b\n- c'],
    ['a fence closed before a spaced item', '- a\n  ```\n  x\n  ```\n\n- b\n- c'],
    ['a task list', '- [ ] todo\n- [x] done\n- [X] shouted\n- plain'],
    ['checkboxes with nothing after them', '- [ ]\n- [x]\n- [ ] x\n- [ ]   '],
    ['a checkbox the stream has half written', '- one\n- [\n- [ \n- [x'],
    ['a checkbox whose next line turns it into a heading', '- a\n- [x] done\n  -\n- [ ] todo\n  ==='],
    ['a checkbox whose continued paragraph turns into a heading', '- [x] done\n  more\n  ===\n- next'],
    ['a checkbox whose continued paragraph turns into a dash heading', '- [ ] a\n  b\n  ---\n- c\n- d'],
    ['a checkbox whose longer paragraph turns into a heading', '- [x] a\n  b\n  c\n  ===\n- d'],
    ['bullets that change marker', '- a\n- b\n* c\n+ d'],
    ['numbers that change delimiter', '1. a\n2. b\n3) c'],
    ['a thematic break between items', '* a\n* * *\n* b'],
    ['a lazy continuation line', '- a\nlazy\n- b\n- c'],
    ['items at different indents', '   - a\n - b\n- c\n  - nested'],
    ['numbers that grow a digit', '8. eight\n9. nine\n10. ten\n    still ten\n11. eleven'],
    ['headings, quotes and tables inside items', '- # Title\n- > quote\n- | a | b |\n  | - | - |\n  | 1 | 2 |\n- end'],
    ['inline markup', '- see [docs](https://mastra.ai) and `code`\n- **bold** *it* ~~gone~~\n- https://mastra.ai'],
    ['emphasis that never closes across items', '- **a\n- b**\n- c'],
    ['blank lines after the list', '- a\n- b\n\n\n'],
    ['an empty item', '- a\n-\n- c'],
    ['markers that land before their text', '- a\n- b\n- \n- c\n\n-'],
    ['numbers that land before their text', '1. a\n2.\n\n3.'],
    ['an item that opens on indented code', '-     code\n- b\n- c'],
    ['a setext heading inside an item', '- foo\n  ===\n- bar\n- baz'],
    ['raw HTML inside an item', '- <b>x</b>\n- y\n- z'],
    ['a link reference resolved across items', '- [a][r]\n- b\n\n[r]: https://mastra.ai'],
    ['a link reference defined deep inside a later item', '9. see [r]\n\n10. x\n\n    [r]: https://mastra.ai'],
    ['a definition whose label spans lines', '- [foo bar]\n\n- second\n\n  [foo\n  bar]: https://mastra.ai'],
    ['tab-indented items', '-\ta\n-\tb\n\t- c'],
    ['an item that starts with a blank line', '-\n  a\n- b\n- c'],
    ['a hard line break inside an item', '- one  \n  two\n- three'],
  ])('renders %s exactly as the whole list does, at every line it streams through', (_, markdown) => {
    const lines = markdown.split('\n');

    for (let end = 1; end <= lines.length; end++) {
      const prefix = lines.slice(0, end).join('\n');

      expect(rendered(prefix), prefix).toBe(whole(prefix));
    }
  });

  it('closes a marker the stream left open inside the item still being written', () => {
    const streamed = renderToStaticMarkup(
      <MarkdownRenderer components={PLAIN} streaming>
        {'0) **bold** text\n\n1) **unclosed bold\n\n'}
      </MarkdownRenderer>,
    );

    expect(streamed).toBe(whole('0) **bold** text\n\n1) **unclosed bold**'));
  });

  it('draws every list through the host’s own list element when it overrides one', () => {
    const components: Components = { ...PLAIN, ul: ({ node: _node, ...props }) => <ul data-host="" {...props} /> };
    const markdown = '- one\n- two\n- three';

    expect(renderToStaticMarkup(<MarkdownRenderer components={components}>{markdown}</MarkdownRenderer>)).toBe(
      renderToStaticMarkup(
        <div className="mastra-markdown">
          <Markdown remarkPlugins={[remarkGfm]} components={components}>
            {markdown}
          </Markdown>
        </div>,
      ),
    );
  });

  it('keeps what a host plugin does to the list itself', () => {
    const tagLists = () => (tree: Root) => {
      for (const node of tree.children) if (node.type === 'list') node.data = { hProperties: { className: 'host' } };
    };
    const markdown = '- one\n- two\n- three';

    expect(renderToStaticMarkup(<MarkdownRenderer remarkPlugins={[tagLists]}>{markdown}</MarkdownRenderer>)).toContain(
      '<ul class="host">',
    );
  });
});
