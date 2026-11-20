/**
 * Text of one written XML slice.
 *
 * Tag gaps and tags are removed with a single left-to-right pass, the same result as one global
 * replace. A second pass would join runs the document kept separate (`</w:t> <w:t> </w:t>`).
 * Entities decode once, with `&amp;` last, so `&amp;lt;` stays the characters `&lt;`.
 */
export function readBackOfficeText(slice: string): string {
  return decodeXmlEntities(stripTags(collapseTagGaps(slice)));
}

function collapseTagGaps(value: string): string {
  const pattern = /(<\/[^>]+>)\s+(<[^>]+>)/g;
  let result = '';
  let last = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index;
    result += value.slice(last, index) + match[1] + match[2];
    last = index + match[0].length;
  }
  return result + value.slice(last);
}

function stripTags(value: string): string {
  let result = '';
  for (let index = 0; index < value.length;) {
    if (value[index] !== '<') {
      result += value[index];
      index += 1;
      continue;
    }
    const end = value.indexOf('>', index + 1);
    if (end === -1) {
      result += value.slice(index);
      break;
    }
    index = end + 1;
  }
  return result;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
