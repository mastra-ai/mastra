"use client";
import { PulsingDots } from "@/components/loading";
import { ArrowLeftIcon } from "@/components/svgs/Icons";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import Spinner from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import "@copilotkit/react-ui/styles.css";
import { useChat } from "@kapaai/react-sdk";
import { ArrowUp } from "lucide-react";
import React, { useState } from "react";
import { Markdown } from "@copilotkit/react-ui";
import { StickToBottom } from "use-stick-to-bottom";
import { Clippy } from "@/components/svgs/clippy";

export function KapaChat({
  setIsAgentMode,
  searchQuery,
}: {
  setIsAgentMode: (isAgentMode: boolean) => void;
  searchQuery: string;
}) {
  const {
    conversation,
    submitQuery,
    isGeneratingAnswer,
    isPreparingAnswer,
    error,
  } = useChat();
  const [inputValue, setInputValue] = useState(searchQuery || "");

  const isLoading = isGeneratingAnswer || isPreparingAnswer;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      submitQuery(inputValue);
      setInputValue("");
    }
  };

  const handleBackToSearch = () => {
    setIsAgentMode(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) {
        submitQuery(inputValue);
        setInputValue("");
      }
    }
  };

  return (
    <div className="flex relative flex-col w-full">
      {/* Chat header */}
      <div className="flex absolute top-0 right-0 left-0 z-20 px-5 py-3 w-full backdrop-blur-md dark:bg-surface-6">
        <Button
          variant="ghost"
          className="cursor-pointer group dark:text-icons-3 text-[var(--light-color-text-4)] dark:bg-surface-5 bg-[var(--light-color-surface-4)]"
          size="slim"
          onClick={handleBackToSearch}
        >
          <ArrowLeftIcon className="w-2 h-2 transition-transform duration-300 group-hover:-translate-x-1" />
          Back to search
        </Button>
      </div>

      <ScrollArea className="h-[600px] overflow-hidden w-full px-5">
        <div className="h-20" />
        <StickToBottom className="overflow-auto flex-1" resize="smooth">
          <StickToBottom.Content className="flex flex-col gap-8">
            {conversation.length > 0
              ? conversation.map(({ answer: a, question: q, id }) => {
                  return (
                    <div key={id} className={`flex flex-col gap-8 w-full`}>
                      {!!q && (
                        <div className="px-4 self-end text-[13px] py-2 rounded-lg max-w-[80%] dark:bg-surface-3 bg-[var(--light-color-surface-4)] dark:text-icons-6 text-[var(--light-color-text-4)]  rounded-br-none">
                          {q}
                        </div>
                      )}

                      {!!a && (
                        <div className="flex gap-4 text-[13px] bg-transparent relative w-full dark:text-icons-6 text-[var(--light-color-text-4)]">
                          {/* <Markdown remarkPlugins={[remarkGfm]}>{a}</Markdown> */}
                          <div className="mt-1 w-5 h-5 shrink-0">
                            <Clippy className="w-full h-full" />
                          </div>

                          <Markdown content={a} />
                        </div>
                      )}
                    </div>
                  );
                })
              : null}
            {isPreparingAnswer && (
              <div className="self-start p-4">
                <PulsingDots />
              </div>
            )}
          </StickToBottom.Content>
        </StickToBottom>
        <div className="h-20" />
      </ScrollArea>

      {/* Input area */}
      <div className="px-2 pb-4">
        <form
          onSubmit={handleSubmit}
          className="border-t dark:border-borders-1 border-[var(--light-border-code)] "
        >
          <div className="flex items-center">
            <Textarea
              id="custom-chat-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your message..."
              className="border-none outline-none shadow-none resize-none dark:text-icons-6 text-[var(--light-color-text-4)] placeholder:text-icons-2 focus-visible:ring-0"
            />
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              disabled={isLoading || inputValue.trim() === ""}
              className="relative self-end p-2 rounded-full cursor-pointer dark:bg-surface-5 bg-[var(--light-color-surface-1)] dark:ring-borders-2 dark:ring"
            >
              {isLoading ? (
                <Spinner className="dark:text-accent-green text-[var(--light-green-accent-2)]" />
              ) : (
                <ArrowUp className="w-4 h-4 dark:text-accent-green text-[var(--light-green-accent)]" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default KapaChat;
