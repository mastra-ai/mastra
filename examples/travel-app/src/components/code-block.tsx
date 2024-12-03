'use client';

interface CodeBlockProps {
  code: string;
  language: string;
  fileName?: string;
}

export default function CodeBlock({ code, language, fileName }: CodeBlockProps) {
  return (
    <div className="w-full rounded-lg overflow-hidden bg-gray-900 text-white">
      {fileName && <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 text-sm">{fileName}</div>}
      <pre className="w-full p-4 overflow-x-auto">
        <code className={`language-${language} w-full`}>{code}</code>
      </pre>
    </div>
  );
}
