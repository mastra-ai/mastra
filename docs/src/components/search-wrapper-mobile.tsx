import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { useState } from "react";
import { CustomSearchWithoutAI } from "./custom-search";
import { Button } from "./ui/button";

export function getSearchPlaceholder(locale = "en") {
  switch (locale) {
    case "ja":
      return "検索するかAIに尋ねる...";
    default:
      return "Search or ask AI...";
  }
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </svg>
  );
}

export const SearchWrapperMobile = ({ locale }: { locale: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  function open() {
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    setIsAgentMode(false);
  }

  function handleUseAgent({ searchQuery }: { searchQuery: string }) {
    setIsAgentMode(true);
    setSearchQuery(searchQuery);
  }

  // Configure Algolia search options
  const searchOptions = {
    indexName: "crawler_mastra crawler",
    hitsPerPage: 20,
    attributesToRetrieve: ["title", "content", "url", "hierarchy"],
    attributesToHighlight: ["title", "content"],
    attributesToSnippet: ["content:15"],
    filters: `locale:${locale}`,
    snippetEllipsisText: "…",
  };

  return (
    <>
      <Button
        onClick={open}
        size="sm"
        variant="ghost"
        className="block cursor-pointer md:hidden w-fit text-icons-3"
      >
        <SearchIcon />
      </Button>
      <Dialog
        open={isOpen}
        as="div"
        className="relative md:hidden z-1000 focus:outline-none"
        onClose={close}
        unmount={true}
      >
        <DialogBackdrop className="fixed inset-0 transition duration-300 ease-out data-closed:opacity-0 bg-black/50 backdrop-blur-md" />
        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex items-center md:pt-[200px] justify-center min-h-full p-4">
            <DialogPanel
              transition
              className="w-full border-[0.5px] border-[var(--light-border-code)] dark:border-borders-2 h-fit max-w-[660px] mx-auto rounded-xl bg-[var(--light-color-surface-15)] dark:bg-surface-4 duration-300 ease-out data-closed:transform-[scale(95%)] data-closed:opacity-0"
            >
              <DialogTitle as="h3" className="sr-only">
                Search
              </DialogTitle>
              <div className="w-full">
                {isAgentMode ? null : (
                  <div className="p-2.5">
                    <CustomSearchWithoutAI
                      searchOptions={searchOptions}
                      closeModal={close}
                    />
                  </div>
                )}
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  );
};
