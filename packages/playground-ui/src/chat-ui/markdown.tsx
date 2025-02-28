import { CopyIcon, CheckIcon } from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function useCopyToClipboard() {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setIsCopied(true);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        timeoutRef.current = setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      })
      .catch(() => {
        console.error('Failed to copy to clipboard.');
      });
  }, []);

  return { isCopied, handleCopy };
}

export const MarkdownCodeBlock = ({ node, inline, className, children, ...props }: any) => {
  const { isCopied, handleCopy: copy } = useCopyToClipboard();

  useEffect(() => {
    setTimeout(() => {
      copy('');
    }, 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCopied]);

  const handleCopy = async (text: string) => {
    copy(text);
  };
  const match = /language-(\w+)/.exec(className || '');

  return !inline && match ? (
    <Highlight theme={themes.oneDark} code={String(children).trim()} language={match[1]}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={`${className} relative font-mono text-sm  overflow-x-auto p-3 rounded-lg mt-2 dark:bg-zinc-800`}
          style={style}
        >
          <button onClick={() => handleCopy(String(children).trim())} className="absolute z-30 right-2 top-2 ">
            {isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
          </button>
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              <span className="inline-block mr-2 text-muted-foreground">{i + 1}</span>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  ) : (
    <code className={`${className} text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md`} {...props}>
      {children}
    </code>
  );
};

const NonMemoizedMarkdown = ({ children }: { children?: string }) => {
  const { isCopied, handleCopy: copy } = useCopyToClipboard();

  useEffect(() => {
    setTimeout(() => {
      copy('');
    }, 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCopied]);

  const handleCopy = async (text: string) => {
    copy(text);
  };
  const components = {
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');

      return !inline && match ? (
        <Highlight theme={themes.oneDark} code={String(children).trim()} language={match[1]}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={`${className} relative font-mono text-sm  overflow-x-auto p-3 rounded-lg mt-2 dark:bg-zinc-800`}
              style={style}
            >
              <button onClick={() => handleCopy(String(children).trim())} className="absolute z-30 right-2 top-2 ">
                {isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
              </button>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  <span className="inline-block mr-2 text-muted-foreground">{i + 1}</span>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      ) : (
        <code className={`${className} text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md`} {...props}>
          {children}
        </code>
      );
    },
    ol: ({ node, children, ...props }: any) => {
      return (
        <ol className="list-decimal list-outside ml-4" {...props}>
          {children}
        </ol>
      );
    },
    li: ({ node, children, ...props }: any) => {
      return (
        <li className="py-1" {...props}>
          {children}
        </li>
      );
    },
    ul: ({ node, children, ...props }: any) => {
      return (
        <ul className="list-decimal list-outside ml-4" {...props}>
          {children}
        </ul>
      );
    },
    strong: ({ node, children, ...props }: any) => {
      return (
        <span className="font-semibold" {...props}>
          {children}
        </span>
      );
    },
    a: ({ node, children, ...props }: any) => {
      return (
        <a className="text-blue-500 hover:underline" target="_blank" rel="noreferrer" {...props}>
          {children}
        </a>
      );
    },
    h1: ({ node, children, ...props }: any) => {
      return (
        <h1 className="text-3xl font-semibold mt-6 mb-2" {...props}>
          {children}
        </h1>
      );
    },
    h2: ({ node, children, ...props }: any) => {
      return (
        <h2 className="text-2xl font-semibold mt-6 mb-2" {...props}>
          {children}
        </h2>
      );
    },
    h3: ({ node, children, ...props }: any) => {
      return (
        <h3 className="text-xl font-semibold mt-6 mb-2" {...props}>
          {children}
        </h3>
      );
    },
    h4: ({ node, children, ...props }: any) => {
      return (
        <h4 className="text-lg font-semibold mt-6 mb-2" {...props}>
          {children}
        </h4>
      );
    },
    h5: ({ node, children, ...props }: any) => {
      return (
        <h5 className="text-base font-semibold mt-6 mb-2" {...props}>
          {children}
        </h5>
      );
    },
    h6: ({ node, children, ...props }: any) => {
      return (
        <h6 className="text-sm font-semibold mt-6 mb-2" {...props}>
          {children}
        </h6>
      );
    },
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
};

export const Markdown = memo(NonMemoizedMarkdown, (prevProps, nextProps) => prevProps.children === nextProps.children);
