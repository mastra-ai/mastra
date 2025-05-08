import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { useEffect, useState } from "react";
import { CustomSearch } from "./custom-search";
import { getSearchPlaceholder } from "./search-placeholder";
import { Button } from "./ui/button";
import DocsChat from "@/chatbot/components/chat-widget";
import { JarvisIcon } from "./svgs/Icons";

const INPUTS = new Set(["INPUT", "SELECT", "BUTTON", "TEXTAREA"]);

export const SearchWrapper = ({ locale }: { locale: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const el = document.activeElement;
      if (
        !el ||
        INPUTS.has(el.tagName) ||
        (el as HTMLElement).isContentEditable
      ) {
        return;
      }
      if (
        event.key === "/" ||
        (event.key === "k" &&
          !event.shiftKey &&
          (navigator.userAgent.includes("Mac") ? event.metaKey : event.ctrlKey))
      ) {
        event.preventDefault();
        // prevent to scroll to top
        setIsOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function open() {
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
  }

  function handleUseAgent({ searchQuery }: { searchQuery: string }) {
    setIsAgentMode(true);
    setSearchQuery(searchQuery);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          onClick={open}
          size="sm"
          variant="ghost"
          className="flex items-center gap-6 cursor-pointer bg-surface-3 text-icons-6"
        >
          <span className="text-sm">Search</span>
          <Shortcut />
        </Button>
      </div>
      <Dialog
        open={isOpen}
        as="div"
        className="relative z-1000 focus:outline-none"
        onClose={close}
        unmount={false}
      >
        <DialogBackdrop className="fixed inset-0 delay-[0ms] duration-300 ease-out bg-black/50 backdrop-blur-md" />
        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex items-start pt-[200px] justify-center min-h-full p-4">
            <DialogPanel
              transition
              className="w-full border-[0.5px] border-borders-2 h-fit max-w-[550px] mx-auto rounded-xl bg-surface-4 duration-300 ease-out data-closed:transform-[scale(95%)] data-closed:opacity-0"
            >
              <DialogTitle as="h3" className="sr-only">
                Search
              </DialogTitle>
              <div className="w-full">
                <div className={isAgentMode ? "block" : "hidden"}>
                  <DocsChat
                    setIsAgentMode={setIsAgentMode}
                    searchQuery={searchQuery}
                  />
                </div>
                <div className={isAgentMode ? "hidden" : "block p-[10px]"}>
                  <CustomSearch
                    placeholder={getSearchPlaceholder(locale)}
                    isAgentMode={isAgentMode}
                    setIsSearching={setIsSearching}
                    onUseAgent={handleUseAgent}
                    closeModal={close}
                  />
                  {!isSearching && (
                    <>
                      <hr className="w-full my-2 text-borders-1" />
                      <Button
                        className="w-full flex items-center font-medium justify-between gap-2 cursor-pointer text-base h-10 pl-4 pr-3 bg-surface-5 text-accent-green bg-[url('/image/bloom-2.png')] bg-cover bg-right"
                        variant="ghost"
                        onClick={() => setIsAgentMode(true)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="">
                            <JarvisIcon className="w-full h-full" />
                          </span>
                          <span>Ask Docs Agent</span>
                        </div>
                        <span className="flex items-center h-8 px-3 text-sm font-medium rounded-sm bg-tag-green-2 text-accent-green justify-self-end">
                          experimental
                        </span>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  );
};

function Shortcut() {
  return (
    <kbd
      className={cn(
        "x:my-1.5 x:select-none x:pointer-events-none x:end-1.5 x:transition-all",
        "x:h-5 x:rounded x:bg-nextra-bg x:px-1.5 x:font-mono x:text-[11px] x:font-medium x:text-gray-600 x:dark:text-gray-400",
        "x:border nextra-border",
        "x:contrast-more:text-current",
        "x:items-center x:gap-1 x:flex",
        "x:max-sm:hidden not-prose",
      )}
    >
      {navigator.userAgent.includes("Mac") ? (
        <>
          <span className="x:text-xs">⌘</span>K
        </>
      ) : (
        "CTRL K"
      )}
    </kbd>
  );
}
