"use client";
import { Highlight, themes } from "prism-react-renderer";
interface CodeBlockProps {
  code: string;
  language: string;
  fileName?: string;
}

export default function CodeBlock({
  code,
  language,
  fileName,
}: CodeBlockProps) {
  return (
    <div className="w-full border-4 border-black rounded-lg overflow-hidden bg-gray-900 text-white">
      {fileName && <div className="px-4 py-2 text-sm">{fileName}</div>}

      <Highlight theme={themes.oneLight} code={code} language={language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`${className} relative font-mono font-medium text-xs  overflow-x-auto p-3 rounded-lg mt-2 bg-black`}
            style={style}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                <span className="inline-block mr-2 text-muted-foreground">
                  {i + 1}
                </span>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
      {/* <pre className="w-full p-4 overflow-x-auto">
        <code className={`language-${language} text-xs w-full`}>{code}</code>
      </pre> */}
    </div>
  );
}
