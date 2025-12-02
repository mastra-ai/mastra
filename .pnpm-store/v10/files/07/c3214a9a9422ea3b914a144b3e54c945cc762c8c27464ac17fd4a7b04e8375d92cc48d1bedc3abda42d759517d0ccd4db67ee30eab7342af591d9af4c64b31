# Node HTML Better Parser

## Fork from Fast HTML Parser [![NPM version](https://badge.fury.io/js/node-html-parser.png)](http://badge.fury.io/js/node-html-parser)

Fast HTML Parser is a _very fast_ HTML parser. Which will generate a simplified
DOM tree, with basic element query support.

Per the design, it intends to parse massive HTML files in lowest price, thus the
performance is the top priority.  For this reason, some malformatted HTML may not
be able to parse correctly, but most usual errors are covered (eg. HTML4 style
no closing `<li>`, `<td>` etc).

**About this fork**: I created this fork to provide a simple API for editing the html and especially the attributes.

__________________________


## Install

```shell
npm install --save node-html-better-parser
```
__________________________

## Performance

Faster than htmlparser2!

```shell
fast-html-parser: 2.18409 ms/file ± 1.37431
high5           : 4.55435 ms/file ± 2.51132
htmlparser      : 27.6920 ms/file ± 171.588
htmlparser2-dom : 6.22320 ms/file ± 3.48772
htmlparser2     : 3.58360 ms/file ± 2.23658
hubbub          : 16.1774 ms/file ± 8.95079
libxmljs        : 7.19406 ms/file ± 7.04495
parse5          : 10.7590 ms/file ± 8.09687
```

Tested with [htmlparser-benchmark](https://github.com/AndreasMadsen/htmlparser-benchmark).
__________________________

## Usage

```ts
import { parse } from 'node-html-better-parser';

const root = parse('<ul id="list"><li>Hello World</li></ul>');

console.log(root.firstChild.structure);
// ul#list
//   li
//     #text

console.log(root.querySelector('#list'));
// { tagName: 'ul',
//   rawAttrs: 'id="list"',
//   childNodes:
//    [ { tagName: 'li',
//        rawAttrs: '',
//        childNodes: [Object],
//        classNames: [] } ],
//   id: 'list',
//   classNames: [] }
console.log(root.toString());
// <ul id="list"><li>Hello World</li></ul>
root.set_content('<li>Hello World</li>');
root.toString();	// <li>Hello World</li>
```

```js
var HTMLParser = require('node-html-parser');

var root = HTMLParser.parse('<ul id="list"><li>Hello World</li></ul>');
```
__________________________

## API

## parse(data[, options])

Parse given data, and return root of the generated DOM.
The root is actually a fictive node that contains the nodes found in the content provided. The content can be found in `root.childNodes`, or accessed with `root.firstChild` if the parsed HTML has a root node (think about `<b>siblings</b> <i>nodes</i>`).

  - **data**, data to parse
  - **options**, parse options

  ```js
  {
    lowerCaseTagName: false,  // convert tag name to lower case (hurt performance heavily)
    script: false,            // retrieve content in <script> (hurt performance slightly)
    style: false,             // retrieve content in <style> (hurt performance slightly)
    pre: false,               // retrieve content in <pre> (hurt performance slightly)
    comment: false            // retrieve comments (hurt performance slightly)
  }
  ```

## isBlock(node: HTMLElement)

Returns weither the provided node is a block. A node is considered a block is it has a tag represented as block instead of inline in html specs.

## HTMLElement

### properties

| property name   | description                                                                                            |
|-----------------|--------------------------------------------------------------------------------------------------------|
| text            | Get unescaped text value of current node and its children. Like `innerText`. (slow for the first time) |
| tagName         | Get the tag name of the current element                                                                |
| classNames      | Get the classes of the current element                                                                 |
| parentNode      | Get the parent HTMLNode                                                                                |
| rawText         | Get escpaed (as-it) text value of current node and its children. May have `&amp;` in it. (fast)        |
| structuredText  | Get structured Text                                                                                    |
| structure       | Get DOM structure                                                                                      |
| childNodes      | Get the children nodes                                                                                 |
| children        | Get the children HTMLElement                                                                           |
| firstChild      | Get first child node                                                                                   |
| lastChild       | Get last child node                                                                                    |
| attributes      | Get attributes                                                                                         |
| rawAttributes   | Get escaped (as-it) attributes                                                                         |
| innerHTML       | Get innerHTML                                                                                          |
| outerHTML       | Get outerHTML                                                                                          |

### methods

| method                                            | parameters                                                                                                                                                                                                 | return                                                                            |
|---------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| trimRight()                                       |                                                                                                                                                                                                            | Trim element from right (in block) after seeing pattern in a TextNode.            |
| removeWhitespace()                                |                                                                                                                                                                                                            | Remove whitespaces in this sub tree.                                              |
| querySelectorAll(selector: string)                |  * **selector**: CSS selector Note: only `tagName`, `#id`, `.class` selectors supported.                                                                                                                   | Query CSS selector to find matching nodes.                                        |
| querySelector(selector: string)                   |  * **selector**: CSS selector Note: only `tagName`, `#id`, `.class` selectors supported. And not behave the same as standard `querySelectorAll()` as it will _stop_ searching sub tree after find a match. | Query CSS selector to find matching node.                                         |
| appendChild(node: Node)                           |  * **node**: HTMLElement or Text node                                                                                                                                                                      | Append a child node to childNodes                                                 |
| setAttribute(key: string, value: string \| null)  |  * **key**: The HTML attribute key  * **value**: The HTML attribute name                                                                                                                                   | Set `value` to `key` attribute. If `value` is null, remove the attribute instead. |
| setAttributes(attributes: Attributes)             |  * **attributes**: An object containing the `key: value` pairs we expect for this node                                                                                                                     | Replace all the current attributes by the provided attribute set.                 |
| removeAttributes(key: string)                     |  * **key**: The HTML attribute key                                                                                                                                                                         | Remove the attribute denoted by `key`.                                            |
| toString()                                        |                                                                                                                                                                                                            | Same as outerHTML                                                                 |
| set_content(content: string \| Node \| Node[])    | * **content**: The new content for this node                                                                                                                                                               | Set content for this node. **Notice**: Do not set content of the **root** node.   |
