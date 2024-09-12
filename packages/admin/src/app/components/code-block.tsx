import { CodeBlock } from 'react-code-block';

function CodeBlockDemo({
  code = "console.log('Hello World!')",
  language = 'ts',
}: {
  code?: string;
  language: 'ts' | 'json';
}) {
  return (
    <CodeBlock code={code} language={language}>
      <CodeBlock.Code className="bg-transparent h-full p-6 rounded-xl">
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
