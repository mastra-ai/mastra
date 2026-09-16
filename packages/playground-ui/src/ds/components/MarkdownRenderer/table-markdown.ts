import type { Definition, FootnoteDefinition, Nodes, Root, Table } from 'mdast';
import { gfmToMarkdown } from 'mdast-util-gfm';
import { toMarkdown } from 'mdast-util-to-markdown';
import { tableToCsv } from './table-csv';

function cellText(node: Nodes): string {
  if (node.type === 'footnoteReference') return `[^${node.label ?? node.identifier}]`;
  if ('value' in node) return node.value;
  if (node.type === 'image' || node.type === 'imageReference') return node.alt ?? '';
  return 'children' in node ? node.children.map(cellText).join('') : '';
}

function walk(node: Nodes, visit: (node: Nodes) => void): void {
  visit(node);
  if ('children' in node) node.children.forEach(child => walk(child, visit));
}

const SERIALIZE_OPTIONS = { extensions: [gfmToMarkdown()] };

/** Capture table exports before rehype replaces text with animation spans. */
export function remarkTableMarkdown() {
  return (tree: Root, file: { value: unknown }) => {
    const source = String(file.value);
    const definitions = new Map<string, Definition | FootnoteDefinition>();
    const tables: Table[] = [];
    walk(tree, node => {
      if (node.type === 'definition' || node.type === 'footnoteDefinition') {
        const key = `${node.type}:${node.identifier}`;
        if (!definitions.has(key)) definitions.set(key, node);
      }
      if (node.type === 'table') tables.push(node);
    });

    const lines = source.split(/\r\n|\r|\n/);
    for (const table of tables) {
      const header = table.children[0];
      if (!header?.position) continue;
      const rows = table.children.map(row => {
        const start = row.position?.start.offset;
        const end = row.position?.end.offset;
        return start === undefined || end === undefined ? undefined : source.slice(start, end);
      });
      // Only offer exports when the parser supplied the original row locations.
      if (!rows.every(row => row !== undefined)) continue;
      // Row positions exclude list/blockquote prefixes. The delimiter has no AST node.
      const delimiter = lines[header.position.start.line]?.replace(/^[\t >]*/, '');
      if (delimiter === undefined) continue;
      const markdown = [rows[0], delimiter, ...rows.slice(1)];
      const used = new Set<string>();
      const collectReference = (node: Nodes) => {
        if (node.type === 'linkReference' || node.type === 'imageReference') {
          used.add(`definition:${node.identifier}`);
        } else if (node.type === 'footnoteReference') {
          used.add(`footnoteDefinition:${node.identifier}`);
        }
      };
      walk(table, collectReference);
      // Visiting appended definitions also collects links/footnotes they depend on.
      // The set prevents duplicates and cycles, including self-referencing footnotes.
      for (const key of used) {
        const definition = definitions.get(key);
        if (!definition) continue;
        markdown.push('', toMarkdown(definition, SERIALIZE_OPTIONS).trimEnd());
        walk(definition, collectReference);
      }
      const cells = table.children.map(row =>
        Array.from({ length: header.children.length }, (_, index) => {
          const cell = row.children[index];
          return cell ? cellText(cell) : '';
        }),
      );
      table.data = {
        ...table.data,
        hProperties: {
          ...table.data?.hProperties,
          tableMarkdown: markdown.join('\n'),
          tableCsv: tableToCsv(cells),
        },
      };
    }
  };
}
