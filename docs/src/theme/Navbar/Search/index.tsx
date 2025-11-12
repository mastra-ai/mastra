import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@radix-ui/react-dialog";
import { CustomSearch } from "@site/src/components/custom-search";
import { Button } from "@site/src/components/ui/button";
import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

const SHORTCUT_OS_KEY = "shortcut-os-preference";

function getInitialIsMac(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const cached = localStorage.getItem(SHORTCUT_OS_KEY);
    if (cached !== null) {
      return cached === "mac";
    }
  } catch (error) {
    console.error(
      "Error reading shortcut preference from localStorage:",
      error,
    );
  }

  return false;
}

export function Shortcut() {
  const [isMac, setIsMac] = useState(getInitialIsMac);

  useEffect(() => {
    const isMacOS = navigator.userAgent.includes("Mac");
    setIsMac(isMacOS);

    try {
      localStorage.setItem(SHORTCUT_OS_KEY, isMacOS ? "mac" : "other");
    } catch (error) {
      console.error("Error saving shortcut preference to localStorage:", error);
    }
  }, []);

  return (
    <kbd className="flex items-center py-2 gap-1 text-xs font-medium text-(--mastra-icons-3)">
      {!isMac ? (
        "CTRL K"
      ) : (
        <span className="inline-flex text-sm gap-1 items-center">
          <span className="text-xs">⌘</span>
          <span className="text-xs">K</span>
        </span>
      )}
    </kbd>
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
    indexName: "docs_crawler",
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
          className="md:flex hidden w-[200px]  items-center pr-[0.38rem] text-sm font-normal justify-between gap-6 cursor-pointer border-[0.5px] bg-(--mastra-surface-4) border-(--border)  text-(--mastra-icons-3)"
        >
          <span className="text-sm">Search docs...</span>
          <Shortcut />
        </Button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 transition-opacity z-250 bg-black/40" />
        <DialogContent className="dialog-panel z-260 fixed left-1/2 top-[100px] -translate-x-1/2  w-full">
          <div className="flex items-start relative top-1/2 justify-center min-h-full p-4">
            <div className="w-full ring ring-neutral-200 dark:ring-(--border) shadow-2xl duration-150 ease-out data-closed:transform-[scale(95%)] data-closed:opacity-0 dark:border-(--border) h-fit max-w-[660px] mx-auto rounded-xl bg-(--ifm-background-color) dark:bg-(--mastra-surface-2) transition-all">
              <DialogTitle className="sr-only">Search docs...</DialogTitle>
              <div className="w-full">
                <CustomSearch
                  searchOptions={searchOptions}
                  closeModal={close}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
