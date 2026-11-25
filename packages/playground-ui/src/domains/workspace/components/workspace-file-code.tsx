import { CodeBlock } from '@/ds/components/CodeBlock/code-block';
import type { CodeBlockProps } from '@/ds/components/CodeBlock/code-block';

export function WorkspaceFileCode(props: CodeBlockProps) {
  return <CodeBlock {...props} overflow="scroll" className="rounded-none border-0 bg-transparent [&_pre]:p-4" />;
}
