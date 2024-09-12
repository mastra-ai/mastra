import { CodeBlock } from 'react-code-block';

import { cn } from '@/lib/utils';

function CodeBlockDemo({
  code = '',
  language = 'ts',
  filename,
}: {
  code?: string;
  language: 'ts' | 'json';
  filename?: string;
}) {
  return (
    <CodeBlock code={code} language={language}>
      {filename ? <div className="absolute text-sm text-kpl-el-6/50 px-6 pl-4 py-2">{filename}</div> : null}

      <CodeBlock.Code className={cn('bg-transparent h-full p-6 rounded-xl', filename ? 'pt-10' : '')}>
        <div className="table-row">
          <CodeBlock.LineNumber className="table-cell pr-4 text-sm text-gray-500 text-right select-none" />
          <CodeBlock.LineContent className="flex">
            <CodeBlock.Token className="kepler-token" />
          </CodeBlock.LineContent>
        </div>
      </CodeBlock.Code>
    </CodeBlock>
  );
}

export { CodeBlockDemo };
