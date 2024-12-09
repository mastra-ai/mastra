// Inspired by Chatbot-UI and modified to fit the needs of this project
// @see https://github.com/mckaywrigley/chatbot-ui/blob/main/components/Markdown/CodeBlock.tsx

"use client";

import { FC, memo, SetStateAction, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coldarkDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

import { Button } from "@/components/ui/button";
import { IconCheck, IconCopy, IconDownload } from "@/components/ui/icons";
import { useCopyToClipboard } from "@/lib/hooks/useCopyToClipboard";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  language: string;
  value: string;
}

interface languageMap {
  [key: string]: string | undefined;
}

export const programmingLanguages: languageMap = {
  javascript: ".js",
  python: ".py",
  java: ".java",
  c: ".c",
  cpp: ".cpp",
  "c++": ".cpp",
  "c#": ".cs",
  ruby: ".rb",
  php: ".php",
  swift: ".swift",
  "objective-c": ".m",
  kotlin: ".kt",
  typescript: ".ts",
  go: ".go",
  perl: ".pl",
  rust: ".rs",
  scala: ".scala",
  haskell: ".hs",
  lua: ".lua",
  shell: ".sh",
  sql: ".sql",
  html: ".html",
  css: ".css",
  yaml: ".yaml",
  zsh: ".zsh",
  // add more file extensions here, make sure the key is same as language prop in CodeBlock.tsx component
};

export const generateRandomString = (length: number, lowercase = false) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXY3456789"; // excluding similar looking characters like Z, 2, I, 1, O, 0
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return lowercase ? result.toLowerCase() : result;
};

const CodeBlock: FC<Props> = memo(({ language, value }) => {
  const [open, setOpen] = useState(false);
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 });
  const [filename, setFilename] = useState(() => {
    const fileExtension = programmingLanguages[language] || ".file";
    const suggestedFileName = `file-${generateRandomString(
      3,
      true
    )}${fileExtension}`;
    return suggestedFileName;
  });

  const downloadAsFile = () => {
    if (!filename) {
      // User pressed cancel on prompt.
      return;
    }

    const blob = new Blob([value], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const onCopy = () => {
    if (isCopied) return;
    copyToClipboard(value);
  };

  return (
    <div className="relative w-full font-sans codeblock bg-zinc-950 rounded-lg">
      <div className="flex items-center justify-between w-full px-6 py-2 pr-4 bg-zinc-800 rounded-t-lg text-zinc-100">
        <div className="flex items-center w-full justify-between  pl-0 px-4 py-2 ">
          <div className="flex gap-2 space-between">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <div className="ml-4 bg-gray-100/10 font-mono px-3 py-1 rounded-md text-sm">
            {language}
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            className="focus-visible:ring-1 transition-colors hover:bg-slate-100/10 group focus-visible:ring-slate-700 focus-visible:ring-offset-0"
            onClick={() => setOpen(true)}
            size="icon"
          >
            <IconDownload className=" text-white" />
            <span className="sr-only">Download</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-xs focus-visible:ring-1 transition-colors hover:bg-slate-100/10 group focus-visible:ring-slate-700 focus-visible:ring-offset-0"
            onClick={onCopy}
          >
            {isCopied ? (
              <IconCheck className="text-white" />
            ) : (
              <IconCopy className="text-white" />
            )}
            <span className="sr-only">Copy code</span>
          </Button>
        </div>
      </div>
      <SyntaxHighlighter
        language={language}
        style={coldarkDark}
        PreTag="div"
        showLineNumbers
        customStyle={{
          margin: 0,
          width: "100%",
          background: "transparent",
          padding: "1.5rem 1rem",
        }}
        lineNumberStyle={{
          userSelect: "none",
        }}
        codeTagProps={{
          style: {
            fontSize: "0.9rem",
            fontFamily: "var(--font-geist-mono)",
          },
        }}
      >
        {value}
      </SyntaxHighlighter>
      <DownloadDialog
        filename={filename}
        setFilename={setFilename}
        open={open}
        setOpen={setOpen}
        downloadFile={downloadAsFile}
      />
    </div>
  );
});
CodeBlock.displayName = "CodeBlock";

export function DownloadDialog({
  open,
  setOpen,
  filename,
  setFilename,
  downloadFile,
}: {
  open: boolean;
  setOpen: React.Dispatch<SetStateAction<boolean>>;
  filename: string;
  setFilename: React.Dispatch<SetStateAction<string>>;
  downloadFile: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download Spec</DialogTitle>
          <DialogDescription>
            Download to edit or save for later.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <div className="grid flex-1 gap-2">
            <label htmlFor="link" className="sr-only">
              Link
            </label>
            <input
              id="link"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-full px-4 py-2 text-sm font-mono pr-8 rounded-md shadow-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-offset-2 focus-visible:ring-[hsl(240,5%,64.9%,0.5)] border"
            />
          </div>
        </div>
        <DialogFooter className="sm:justify-start">
          <Button onClick={downloadFile} type="button" variant="secondary">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { CodeBlock };
