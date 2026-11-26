import { createHash, randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmAutolinkLiteralFromMarkdown } from 'mdast-util-gfm-autolink-literal';
import { gfmAutolinkLiteral } from 'micromark-extension-gfm-autolink-literal';
import { z } from 'zod';
import { bundledPolicyRevisions } from '../../examples/approved-policies.ts';
import { withWriterLock } from './writer-lock.ts';

const revisionsSchema = z.record(z.string(), z.array(z.string().regex(/^[a-f0-9]{64}$/u)));
type ApprovedRevisions = z.infer<typeof revisionsSchema>;

export async function readApprovedPolicyRevisions(file?: string): Promise<ApprovedRevisions> {
  return file ? revisionsSchema.parse(JSON.parse(await readFile(file, 'utf8'))) : {};
}

export async function replaceApprovedPolicyRevisions(
  source: string,
  destination = process.env.SUPPORT_POLICY_APPROVAL_FILE,
) {
  if (!destination) throw new Error('Set SUPPORT_POLICY_APPROVAL_FILE before replacing policy approvals');
  const approved = await readApprovedPolicyRevisions(source);
  await withWriterLock(async () => {
    const temporary = `${destination}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(approved, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    try {
      await rename(temporary, destination);
    } finally {
      await rm(temporary, { force: true });
    }
  });
}

type MarkdownNode = { type: string; value?: string; children?: MarkdownNode[] };

function visibleText(node: MarkdownNode): string {
  if (node.type === 'html') return '';
  return node.value ?? node.children?.map(visibleText).join('') ?? '';
}

function instructionText(node: MarkdownNode): string {
  if (
    [
      'heading',
      'link',
      'linkReference',
      'definition',
      'image',
      'imageReference',
      'html',
      'code',
      'inlineCode',
    ].includes(node.type)
  )
    return '';
  if (node.type === 'paragraph' && /^\s*Source:/iu.test(visibleText(node))) return '';
  if (node.value !== undefined) return node.value.replace(/\[\[[^\r\n]*?\]\]|^[ \t]*Source:.*$/gmu, '');
  return node.children?.map(instructionText).join(' ') ?? '';
}

const maxPolicyCharacters = 800;
const requiredSections = ['Before changes', 'Prohibited actions', 'When uncertain'];

export function requiredPolicyContentIssue(body: string, ref: string, approved: ApprovedRevisions): string | undefined {
  const rendered = body.trim();
  if (rendered.length > maxPolicyCharacters) return `Rendered body exceeds the ${maxPolicyCharacters}-character limit`;

  // The page is delivered as Markdown by the native pin. Only guidance under a named section counts.
  const document = fromMarkdown(rendered, {
    extensions: [gfmAutolinkLiteral()],
    mdastExtensions: [gfmAutolinkLiteralFromMarkdown()],
  });
  const sections = new Map<string, string[]>();
  let instructions: string[] | undefined;
  for (const node of document.children) {
    if (node.type !== 'heading') {
      instructions?.push(instructionText(node));
      continue;
    }
    if (node.depth > 2) continue;
    instructions = undefined;
    if (node.depth !== 2 || node.children.length !== 1 || node.children[0]?.type !== 'text') continue;
    const name = node.children[0].value;
    if (!requiredSections.includes(name)) continue;
    if (sections.has(name)) return `Duplicate required policy section ${name}`;
    instructions = [];
    sections.set(name, instructions);
  }
  for (const name of requiredSections) {
    const words =
      sections
        .get(name)
        ?.join(' ')
        .toLowerCase()
        .match(/[\p{L}]{2,}/gu) ?? [];
    if (new Set(words).size < 3) return `Expected substantive policy instructions under the ${name} heading`;
  }
  const revision = createHash('sha256').update(rendered).digest('hex');
  if (bundledPolicyRevisions[ref] !== revision && !approved[ref]?.includes(revision))
    return `Rendered policy revision ${revision} is not approved`;
}
