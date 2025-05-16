import DocsChat from "@/chatbot/components/chat-widget";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { useEffect, useState } from "react";
import { CustomSearch } from "./custom-search";
import { getSearchPlaceholder } from "./search-placeholder";
import { Shortcut } from "./shortcut";
import { Button } from "./ui/button";

const INPUTS = new Set(["INPUT", "SELECT", "BUTTON", "TEXTAREA"]);

export const SearchWrapper = ({ locale }: { locale: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAgentMode, setIsAgentMode] = useState(false);
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
    setIsAgentMode(false);
  }

  function handleUseAgent({ searchQuery }: { searchQuery: string }) {
    setIsAgentMode(true);
    setSearchQuery(searchQuery);
  }

  return (
    <>
      <div className="hidden md:block absolute inset-0 m-auto w-[460px] h-fit">
        <Button
          onClick={open}
          size="sm"
          variant="ghost"
          className="flex items-center pr-[0.38rem] text-sm font-normal justify-between w-full gap-6 cursor-pointer border-[0.5px] bg-[var(--light-color-surface-4)] dark:bg-[var(--light-color-text-5)] border-[var(--light-border-muted)] dark:border-borders-1 text-icons-3"
        >
          <span className="text-sm">Search or ask AI..</span>
          <Shortcut />
        </Button>
      </div>
      <Dialog
        open={isOpen}
        as="div"
        className="relative hidden md:block z-1000 focus:outline-none"
        onClose={close}
      >
        <DialogBackdrop className="fixed inset-0 transition duration-250 data-closed:opacity-0 ease-out bg-black/20 backdrop-blur-md" />
        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex items-start pt-[200px] justify-center min-h-full p-4">
            <DialogPanel
              transition
              className="w-full border-[0.5px] border-[var(--light-border-code)] dark:border-borders-2 h-fit max-w-[660px] mx-auto rounded-xl bg-[var(--light-color-surface-15)] dark:bg-surface-4 transition duration-250 ease-out data-closed:transform-[scale(95%)] data-closed:opacity-0"
            >
              <DialogTitle as="h3" className="sr-only">
                Search
              </DialogTitle>
              <div className="w-full">
                {isAgentMode ? (
                  <DocsChat
                    setIsAgentMode={setIsAgentMode}
                    searchQuery={searchQuery}
                  />
                ) : (
                  <div className="p-[10px]">
                    <CustomSearch
                      placeholder={getSearchPlaceholder(locale)}
                      onUseAgent={handleUseAgent}
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
