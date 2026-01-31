import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@radix-ui/react-dialog";
import { Search as SearchIcon } from "lucide-react";
import { CustomSearch } from "@site/src/components/custom-search";
import { Button } from "@site/src/components/ui/button";
import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useChatbotSidebar } from "@site/src/theme/DocRoot/Layout/ChatbotSidebar/context";

export function Shortcut({ shortcut }: { shortcut: string }) {
  const [os, setOS] = useState<"mac" | "other" | null>(null);

  useEffect(() => {
    const userAgent = navigator.userAgent;

    if (userAgent.includes("Mac")) {
      setOS("mac");
    } else {
      setOS("other");
    }
  }, []);

  return (
    <>
      {os ? (
        <kbd className="flex items-center py-2 gap-1 text-xs font-medium text-(--mastra-icons-3)">
          {os === "mac" ? `⌘ ${shortcut}` : `CTRL + ${shortcut}`}
        </kbd>
      ) : null}
    </>
  );
}

export default function SearchContainer({ locale }: { locale: string }) {
  const [isOpen, setIsOpen] = useState(false);

  useHotkeys("meta+k", () => setIsOpen((open) => !open));

  function open() {
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
  }
  // Configure Algolia search options
  const searchOptions = {
    indexName: "docs_v1_crawler",
    hitsPerPage: 20,
    attributesToRetrieve: [
      "hierarchy",
      "content",
      "anchor",
      "url",
      "url_without_anchor",
      "type",
      "section",
      "lang",
      "priority",
      "depth",
    ],
    attributesToHighlight: [
      "hierarchy.lvl1",
      "hierarchy.lvl2",
      "hierarchy.lvl3",
      "content",
    ],
    attributesToSnippet: ["content:30"],
    filters: `lang:${locale}`,
    snippetEllipsisText: "…",
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          onClick={open}
          size="sm"
          variant="ghost"
          className="w-9 lg:w-46 xl:w-64 items-center text-sm font-normal gap-2 cursor-pointer border-[0.5px] border-transparent lg:bg-(--mastra-surface-4) lg:border-(--border)"
        >
          <SearchIcon className="text-(--mastra-icons-1)" />
          <span className="text-sm hidden lg:block text-(--mastra-icons-2)">
            Search documentation
          </span>
          <div className="ml-auto hidden xl:block">
            <Shortcut shortcut="K" />
          </div>
        </Button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 transition-opacity z-250 bg-black/50 backdrop-blur-[2px]">
          <DialogContent className="dialog-panel p-6 z-260 relative my-8 lg:my-[15vh] mx-auto max-w-2xl">
            <DialogTitle className="sr-only">Search documentation</DialogTitle>
            <div className="w-full shadow-2xl duration-150 ease-out dark:border-(--border) h-fit mx-auto rounded-xl bg-(--ifm-background-color) dark:bg-(--mastra-surface-2) transition-all">
              <CustomSearch searchOptions={searchOptions} closeModal={close} />
            </div>
          </DialogContent>
        </DialogOverlay>
      </DialogPortal>
    </Dialog>
  );
}

export function AskAI() {
  const { toggle } = useChatbotSidebar();

  return (
    <Button
      onClick={toggle}
      size="sm"
      variant="outline"
      className="rounded-lg shadow-none dark:bg-(--mastra-surface-4) border-[0.5px] border-(--border) text-(--mastra-text-secondary) hover:bg-(--mastra-surface-2) hover:text-(--mastra-text-primary)"
    >
      <span className="text-sm">Ask AI</span>
    </Button>
  );
}
