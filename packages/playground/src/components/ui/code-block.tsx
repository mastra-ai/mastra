import { themes } from 'prism-react-renderer';
import { CodeBlock } from 'react-code-block';

function CodeBlockDemo({
  code = '',
  language = 'ts',
  className,
}: {
  code?: string;
  language: 'ts' | 'json';
  className?: string;
}) {
  return (
    <CodeBlock code={code} language={language} theme={themes.oneDark}>
      <CodeBlock.Code className={className}>
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
