'use client';

import Handlebars from 'handlebars';

import { Label } from '@/ds/components/Label';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Section } from '@/domains/cms';
import { BranchIcon } from '@/ds/icons';

type HbsNode = {
  type: string;
  name?: { original?: string };
  body?: HbsNode[];
  program?: { body?: HbsNode[] };
  inverse?: { body?: HbsNode[] };
};

function collectPartialNames(nodes: HbsNode[], result: Set<string>): void {
  for (const node of nodes) {
    if (node.type === 'PartialStatement' && node.name?.original) {
      result.add(node.name.original);
    }
    // Recurse into block statements (if/each/with/etc.)
    if (node.program?.body) {
      collectPartialNames(node.program.body, result);
    }
    if (node.inverse?.body) {
      collectPartialNames(node.inverse.body, result);
    }
  }
}

export function extractPartialNames(instructions: string): string[] {
  if (!instructions) return [];

  try {
    const ast = Handlebars.parse(instructions);
    const partialNames = new Set<string>();
    collectPartialNames(ast.body as HbsNode[], partialNames);
    return [...partialNames];
  } catch {
    // If parsing fails, return empty array
    return [];
  }
}

interface PartialsEditorProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  detectedNames: string[];
}

export function PartialsEditor({ value, onChange, detectedNames }: PartialsEditorProps) {
  const handlePartialChange = (name: string, content: string) => {
    onChange({ ...value, [name]: content });
  };

  return (
    <Section
      title={<Section.Title icon={<BranchIcon className="text-accent5" />}>Partials</Section.Title>}
      className="pb-4"
    >
      <div className="flex flex-col gap-3">
        <p className="text-ui-xs text-icon3">Partials detected from your instructions. Define their content below.</p>

        {detectedNames.map(name => (
          <div key={name} className="flex flex-col gap-1.5 p-3 bg-surface2 rounded-md border border-border1">
            <Label className="text-ui-xs text-icon5 font-mono">
              {'{{>'} {name} {'}}'}
            </Label>
            <CodeEditor
              value={value[name] || ''}
              onChange={val => handlePartialChange(name, val || '')}
              language="markdown"
              showCopyButton={false}
              placeholder={`Enter content for {{> ${name}}}...`}
              className="min-h-[80px]"
            />
          </div>
        ))}
      </div>
    </Section>
  );
}
