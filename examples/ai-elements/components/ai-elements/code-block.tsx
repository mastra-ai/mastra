"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";

type CodeBlockContextType = {
  code: string;
};

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: "",
});

export type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language: string;
  showLineNumbers?: boolean;
  children?: ReactNode;
};

export const CodeBlock = ({
  code,
  language,
  showLineNumbers = false,
  className,
  children,
  ...props
}: CodeBlockProps) => (
  <CodeBlockContext.Provider value={{ code }}>
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-md border bg-background text-foreground",
        className
      )}
      {...props}
    >
      <div className="relative">
        <SyntaxHighlighter
          className="overflow-hidden dark:hidden"
          codeTagProps={{
            className: "font-mono text-sm",
          }}
          customStyle={{
            margin: 0,
            padding: "1rem",
            fontSize: "0.875rem",
            background: "hsl(var(--background))",
            color: "hsl(var(--foreground))",
          }}
          language={language}
          lineNumberStyle={{
            color: "hsl(var(--muted-foreground))",
            paddingRight: "1rem",
            minWidth: "2.5rem",
          }}
          showLineNumbers={showLineNumbers}
          style={oneLight}
        >
          {code}
        </SyntaxHighlighter>
        <SyntaxHighlighter
          className="hidden overflow-hidden dark:block"
          codeTagProps={{
            className: "font-mono text-sm",
          }}
          customStyle={{
            margin: 0,
            padding: "1rem",
            fontSize: "0.875rem",
            background: "hsl(var(--background))",
            color: "hsl(var(--foreground))",
          }}
          language={language}
          lineNumberStyle={{
            color: "hsl(var(--muted-foreground))",
            paddingRight: "1rem",
            minWidth: "2.5rem",
          }}
          showLineNumbers={showLineNumbers}
          style={oneDark}
        >
          {code}
        </SyntaxHighlighter>
        {children && (
          <div className="absolute top-2 right-2 flex items-center gap-2">
            {children}
          </div>
        )}
      </div>
    </div>
  </CodeBlockContext.Provider>
);

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const { code } = useContext(CodeBlockContext);

  const copyToClipboard = async () => {
    if (typeof window === "undefined" || !navigator.clipboard.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      onCopy?.();
      setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      className={cn("shrink-0", className)}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon size={14} />}
    </Button>
  );
};
