import { themes } from 'prism-react-renderer';
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
    <CodeBlock code={code} language={language} theme={themes.oneDark}>
      {filename ? (
        <div className="absolute  rounded bg-mastra-bg-2 w-full text-sm text-mastra-el-6/50 px-6 pl-4 py-2">
          {filename}
        </div>
      ) : null}

      <CodeBlock.Code className={cn('bg-transparent h-full p-6 rounded-xl', filename ? 'pt-10' : '')}>
        <div className="table-row">
          <div className="flex items-center">
            <CodeBlock.LineNumber className="table-cell pr-4 text-sm text-gray-500/50 text-right select-none" />
            <CodeBlock.LineContent className="flex">
              <CodeBlock.Token className="mastra-token text-sm font-mono" />
            </CodeBlock.LineContent>
          </div>
        </div>
      </CodeBlock.Code>
    </CodeBlock>
  );
}

export { CodeBlockDemo };
