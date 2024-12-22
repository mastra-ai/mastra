import { themes } from 'prism-react-renderer';
import { CodeBlock } from 'react-code-block';

import { cn } from '../../lib/utils';

function CodeBlockDemo({
  code = '',
  language = 'ts',
  filename,
  className,
}: {
  code?: string;
  language: 'ts' | 'json';
  filename?: string;
  className?: string;
}) {
  return (
    <CodeBlock code={code} language={language} theme={themes.oneDark}>
      {filename ? (
        <div className="absolute w-full px-6 py-2 pl-4 text-sm rounded bg-mastra-bg-2 text-mastra-el-6/50">
          {filename}
        </div>
      ) : null}

      <CodeBlock.Code
        className={cn('bg-transparent h-full p-6 rounded-xl whitespace-pre-wrap', filename ? 'pt-10' : '', className)}
      >
        <div className="table-row">
          <div className="flex items-center">
            <CodeBlock.LineNumber className="table-cell pr-4 text-sm text-right select-none text-gray-500/50" />
            <CodeBlock.LineContent className="flex">
              <CodeBlock.Token className="font-mono text-sm mastra-token" />
            </CodeBlock.LineContent>
          </div>
        </div>
      </CodeBlock.Code>
    </CodeBlock>
  );
}

export { CodeBlockDemo };
