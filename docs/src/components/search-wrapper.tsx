import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { KapaProvider } from "@kapaai/react-sdk";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";
import { CustomSearch } from "./custom-search";
import { getSearchPlaceholder } from "./search-placeholder";
import { Shortcut } from "./shortcut";
import { Button } from "./ui/button";

const INPUTS = new Set(["INPUT", "SELECT", "BUTTON", "TEXTAREA"]);

export const SearchWrapper = ({ locale }: { locale: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const posthog = usePostHog();

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
    <KapaProvider
      integrationId={process.env.NEXT_PUBLIC_KAPA_INTEGRATION_ID!}
      callbacks={{
        askAI: {
          onQuerySubmit({ question, threadId, conversation }) {
            posthog.capture("DOCS_CHATBOT_QUESTION", {
              question,
              thread_id: threadId,
              conversation_length: conversation.length,
              timestamp: new Date().toISOString(),
            });
          },
          onAnswerGenerationCompleted({
            answer,
            question,
            threadId,
            questionAnswerId,
            conversation,
          }) {
            posthog.capture("DOCS_CHATBOT_RESPONSE", {
              answer,
              question,
              question_answer_id: questionAnswerId,
              thread_id: threadId,
              conversation_length: conversation.length,
              answer_length: answer.length,
              timestamp: new Date().toISOString(),
            });
          },
        },
      }}
    >
      <div className="hidden md:block absolute inset-0 m-auto w-[460px] h-fit">
        <Button
          onClick={open}
          size="sm"
          variant="ghost"
          className="flex items-center pr-[0.38rem] text-sm font-normal justify-between w-full gap-6 cursor-pointer border-[0.5px] bg-[var(--light-color-surface-4)] dark:bg-[var(--light-color-text-5)] border-[var(--light-border-muted)] dark:border-borders-1 text-icons-3"
        >
          <span className="text-sm">Search docs...</span>
          <Shortcut />
        </Button>
      </div>
      <Dialog
        open={isOpen}
        as="div"
        className="hidden relative md:block z-1000 focus:outline-none"
        onClose={close}
      >
        <DialogBackdrop className="fixed inset-0 data-closed:opacity-0 bg-white/80 dark:bg-black/70" />
        <div className="overflow-y-auto fixed inset-0 z-10 w-screen">
          <div className="flex items-start pt-[100px] justify-center min-h-full p-4">
            <DialogPanel
              transition
              className="w-full overflow-hidden ring ring-neutral-200 dark:ring-neutral-800 h-fit max-w-[600px] mx-auto rounded-xl bg-[var(--light-color-surface-15)] dark:bg-surface-4 transition duration-150 ease-out data-closed:transform-[scale(95%)] data-closed:opacity-0"
            >
              <DialogTitle as="h3" className="sr-only">
                Search docs...
              </DialogTitle>
              <div className="w-full">
                <CustomSearch
                  placeholder={getSearchPlaceholder(locale)}
                  searchOptions={searchOptions}
                  closeModal={close}
                />
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </KapaProvider>
  );
};
