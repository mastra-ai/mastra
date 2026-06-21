import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui';
import { Info } from 'lucide-react';
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coldarkDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import remarkGfm from 'remark-gfm';
import { getWorkspaceFileName } from './workspace-file-preview-utils';

interface WorkspaceTextPreviewProps {
  content: string;
  language?: string | null;
  mimeType?: string;
  path: string;
}

type RenderableTextKind = 'html' | 'markdown' | 'mdx';

function getFileExtension(path: string) {
  return getWorkspaceFileName(path).split('.').pop()?.toLowerCase();
}

function getRenderableTextKind(path: string, mimeType?: string): RenderableTextKind | null {
  const extension = getFileExtension(path);

  if (extension === 'html' || extension === 'htm' || mimeType === 'text/html') return 'html';
  if (extension === 'mdx' || mimeType === 'text/mdx' || mimeType === 'application/mdx') return 'mdx';
  if (
    extension === 'md' ||
    mimeType === 'text/markdown'
  ) {
    return 'markdown';
  }

  return null;
}

function normalizeLanguage(language?: string | null) {
  if (!language) return null;
  if (language === 'mdx') return 'markdown';
  return language;
}

function HighlightedCode({ content, language }: { content: string; language: string }) {
  return (
    <SyntaxHighlighter
      language={language}
      style={coldarkDark}
      customStyle={{
        margin: 0,
        padding: '1rem',
        backgroundColor: 'transparent',
        fontSize: '0.875rem',
        overflowX: 'hidden',
      }}
      codeTagProps={{
        style: {
          fontFamily: 'var(--font-mono)',
          overflowWrap: 'anywhere',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        },
      }}
      wrapLongLines
    >
      {content}
    </SyntaxHighlighter>
  );
}

function WorkspaceCodePreview({ content, language }: { content: string; language?: string | null }) {
  const normalizedLanguage = normalizeLanguage(language);

  if (normalizedLanguage) {
    return <HighlightedCode content={content} language={normalizedLanguage} />;
  }

  return <pre className="whitespace-pre-wrap break-words p-4 font-mono text-sm text-neutral5">{content}</pre>;
}

function getBracketBalanceDelta(line: string) {
  const withoutStrings = line.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '');
  let balance = 0;

  for (const character of withoutStrings) {
    if (character === '(' || character === '{' || character === '[') balance += 1;
    if (character === ')' || character === '}' || character === ']') balance -= 1;
  }

  return balance;
}

function stripMdxEsmBlocks(content: string) {
  const lines = content.split('\n');
  const output: string[] = [];
  let isInFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (/^(```|~~~)/.test(trimmed)) {
      isInFence = !isInFence;
      output.push(line);
      continue;
    }

    if (isInFence) {
      output.push(line);
      continue;
    }

    if (/^import\b/.test(trimmed) || /^export\b/.test(trimmed)) {
      let balance = getBracketBalanceDelta(line);
      const isSingleLineStatement =
        balance <= 0 &&
        (/^import\b.*\bfrom\b/.test(trimmed) ||
          /^import\b/.test(trimmed) ||
          (/^export\b/.test(trimmed) && !/(=>\s*\(|=\s*[({\[]|function\b|class\b)/.test(trimmed)));

      if (isSingleLineStatement) {
        continue;
      }

      while (
        index + 1 < lines.length &&
        (balance > 0 || (!/[;)}]\s*$/.test(trimmed) && !/^import\b.*\bfrom\b/.test(trimmed)))
      ) {
        index += 1;
        balance += getBracketBalanceDelta(lines[index]);

        if (balance <= 0 && /^[;)}]\s*;?$/.test(lines[index].trim())) {
          break;
        }
      }

      continue;
    }

    output.push(line);
  }

  return output.join('\n');
}

function getMdxMarkdownPreviewContent(content: string) {
  return stripMdxEsmBlocks(content)
    .replace(/<\/[A-Z][\w.:-]*\s*>/g, '')
    .replace(/<([A-Z][\w.:-]*)(?:\s+[^>]*)?\/>/g, '')
    .replace(/<([A-Z][\w.:-]*)(?:\s+[^>]*)?>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hasMdxRuntimeSyntax(content: string) {
  return stripMdxEsmBlocks(content) !== content || /<\/?[A-Z][\w.:-]*(?:\s|>|\/>)/.test(content);
}

function WorkspaceHtmlPreview({ content, fileName }: { content: string; fileName: string }) {
  return (
    <iframe
      title={`Preview of ${fileName}`}
      sandbox=""
      srcDoc={content}
      className="h-full min-h-[320px] w-full border-0 bg-white"
    />
  );
}

function WorkspaceMarkdownPreview({ content, isMdx = false }: { content: string; isMdx?: boolean }) {
  const normalizedContent = content.replace(/\\n/g, '\n');
  const previewContent = isMdx ? getMdxMarkdownPreviewContent(normalizedContent) : normalizedContent;
  const shouldShowMdxNotice = isMdx && hasMdxRuntimeSyntax(normalizedContent);

  return (
    <div className="mx-auto w-full max-w-3xl p-5 text-sm text-neutral5">
      {shouldShowMdxNotice ? (
        <div className="mb-4 flex gap-2 rounded-md border border-border1 bg-surface2 p-3 text-xs text-neutral4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral3" />
          <p>
            MDX component code is not executed in Preview. JSX wrappers are omitted here; the exact source remains in
            Code.
          </p>
        </div>
      ) : null}
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, ...props }) => (
            <a className="underline underline-offset-2" {...props}>
              {children}
            </a>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote className="border-l-2 border-neutral6 pl-4" {...props}>
              {children}
            </blockquote>
          ),
          code: ({ children, className, ...props }) => (
            <code className={className ?? 'rounded-md bg-surface2 px-1 py-0.5 font-mono'} {...props}>
              {children}
            </code>
          ),
          h1: ({ children, ...props }) => (
            <h1 className="text-2xl font-semibold" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-xl font-semibold" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-lg font-semibold" {...props}>
              {children}
            </h3>
          ),
          li: ({ children, ...props }) => (
            <li className="my-1.5" {...props}>
              {children}
            </li>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal space-y-2 pl-6" {...props}>
              {children}
            </ol>
          ),
          p: ({ children, ...props }) => (
            <p className="whitespace-pre-wrap leading-relaxed" {...props}>
              {children}
            </p>
          ),
          pre: ({ children, ...props }) => (
            <pre className="overflow-auto rounded-md bg-surface2 p-3 font-mono text-xs" {...props}>
              {children}
            </pre>
          ),
          ul: ({ children, ...props }) => (
            <ul className="list-disc space-y-2 pl-6" {...props}>
              {children}
            </ul>
          ),
        }}
        className="space-y-3"
      >
        {previewContent}
      </Markdown>
    </div>
  );
}

export function WorkspaceTextPreview({ content, language, mimeType, path }: WorkspaceTextPreviewProps) {
  const renderableTextKind = getRenderableTextKind(path, mimeType);
  const fileName = getWorkspaceFileName(path);

  if (!renderableTextKind) {
    return <WorkspaceCodePreview content={content} language={language} />;
  }

  return (
    <Tabs defaultTab="preview" className="flex h-full min-h-[280px] flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border1 px-3 py-2">
        <TabList variant="pill-ghost">
          <Tab value="preview">Preview</Tab>
          <Tab value="code">Code</Tab>
        </TabList>
      </div>
      <TabContent value="preview" className="min-h-0 flex-1 overflow-auto p-0 py-0">
        {renderableTextKind === 'html' ? (
          <WorkspaceHtmlPreview content={content} fileName={fileName} />
        ) : (
          <WorkspaceMarkdownPreview content={content} isMdx={renderableTextKind === 'mdx'} />
        )}
      </TabContent>
      <TabContent value="code" className="min-h-0 flex-1 overflow-auto p-0 py-0">
        <WorkspaceCodePreview content={content} language={language} />
      </TabContent>
    </Tabs>
  );
}
