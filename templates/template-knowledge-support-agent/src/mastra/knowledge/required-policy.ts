import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmAutolinkLiteralFromMarkdown } from 'mdast-util-gfm-autolink-literal';
import { gfmAutolinkLiteral } from 'micromark-extension-gfm-autolink-literal';

type MarkdownNode = { type: string; value?: string; children?: MarkdownNode[] };

function instructionText(node: MarkdownNode): string {
  if (['heading', 'link', 'linkReference', 'definition', 'image', 'imageReference', 'html', 'code'].includes(node.type))
    return '';
  return node.value ?? node.children?.map(instructionText).join(' ') ?? '';
}

const maxPolicyCharacters = 800;

export function requiredPolicyContentIssue(body: string): string | undefined {
  if (body.length > maxPolicyCharacters) return `Rendered body exceeds the ${maxPolicyCharacters}-character limit`;

  // Seed attribution, headings, links, and code blocks alone cannot satisfy a mandatory policy.
  const markdown = body.replace(/<!--[\s\S]*?-->|\[\[[\s\S]*?\]\]|^Source:.*$/gmu, '');
  const document = fromMarkdown(markdown, {
    extensions: [gfmAutolinkLiteral()],
    mdastExtensions: [gfmAutolinkLiteralFromMarkdown()],
  });
  const text = instructionText(document).trim();
  const words = text.toLowerCase().match(/[a-z]{2,}/gu) ?? [];
  if (text.length < 40 || words.length < 6 || new Set(words).size < 4 || !/[a-z]{3}/iu.test(text))
    return 'Expected substantive policy instructions after removing headings, links, attribution, and code blocks';
}
