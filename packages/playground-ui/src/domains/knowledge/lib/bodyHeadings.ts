const HEADING = /^(#{1,3})[ \t]+(.+?)[ \t#]*$/gm;
const FENCED = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^\1[ \t]*$|(?![\s\S]))/gm;

export function bodyHeadings(body: string): Array<{ depth: number; text: string }> {
  return [...body.replace(FENCED, '').matchAll(HEADING)].map(([, hashes, text]) => ({
    depth: hashes?.length ?? 1,
    text: (text ?? '').replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/[*_`]/g, ''),
  }));
}
