"use client";
import { PulsingDots } from "@/components/loading";
import { Clippy } from "@/components/svgs/clippy";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Markdown } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { useChat } from "@kapaai/react-sdk";
import { ArrowUp, Square, ThumbsDown, ThumbsUp, X } from "lucide-react";
import React, { useState } from "react";
import { useStickToBottom } from "use-stick-to-bottom";

export function KapaChat({
  className,
  close,
}: {
  className?: string;
  close: () => void;
}) {
  const {
    conversation,
    submitQuery,
    isGeneratingAnswer,
    isPreparingAnswer,
    stopGeneration,
    addFeedback,
  } = useChat();
  const [inputValue, setInputValue] = useState("");

  const isLoading = isGeneratingAnswer || isPreparingAnswer;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      submitQuery(inputValue);
      setInputValue("");
    }
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

  const handleFeedback = (
    questionAnswerId: string,
    reaction: "upvote" | "downvote",
  ) => {
    addFeedback(questionAnswerId, reaction);
  };

  const { scrollRef, contentRef } = useStickToBottom();

  return (
    <div className={cn("flex relative flex-col w-full h-[700px]", className)}>
      {/* Chat header */}
      <div className="flex absolute top-0 right-0 left-0 z-20 justify-between items-center px-5 py-3 w-full border-b backdrop-blur-md border-neutral-200 dark:border-neutral-800 dark:bg-surface-6">
        <span className="text-sm dark:text-icons-5">
          Chat with Mastra Docs"
        </span>
        <Button
          onClick={() => close()}
          variant="ghost"
          size="sm"
          className="self-end p-0 w-8 h-8 cursor-pointer"
          aria-label="Close chat"
        >
          <X className="w-4 h-4 dark:text-icons-5" />
        </Button>
      </div>

      <div className="overflow-y-auto px-5 h-full" ref={scrollRef}>
        <div ref={contentRef} className="flex flex-col gap-8">
          {/* spacer */}
          <div className="h-12" />
          {conversation.length > 0
            ? conversation.map(({ answer: a, question: q, id, reaction }) => {
                return (
                  <div key={id} className={`flex flex-col gap-8 w-full`}>
                    {!!q && (
                      <div className="px-4 self-end text-[13px] py-2 rounded-lg max-w-[80%] dark:bg-surface-3 bg-[var(--light-color-surface-4)] dark:text-icons-6 text-[var(--light-color-text-4)]  rounded-br-none">
                        {q}
                      </div>
                    )}

                    {!!a && (
                      <div className="relative pl-4 text-[13px] bg-transparent max-w-full dark:text-icons-6 text-[var(--light-color-text-4)]">
                        <Clippy className="absolute top-1 -left-2 w-5 h-5 dark:text-accent-green text-accent-green-2" />
                        <Markdown content={a} />
                        {/* Feedback buttons - only show when answer is complete */}
                        {id && (
                          <div className="flex gap-2 items-center mt-3">
                            <span className="text-xs text-icons-2">
                              Was this helpful?
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleFeedback(id, "upvote")}
                              className={`p-1 cursor-pointer ${
                                reaction === "upvote"
                                  ? "dark:text-accent-green text-[var(--light-green-accent)]"
                                  : "dark:text-icons-3 text-[var(--light-color-text-4)]"
                              }`}
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleFeedback(id, "downvote")}
                              className={`p-1 cursor-pointer ${
                                reaction === "downvote"
                                  ? "dark:text-red-500 text-red-600"
                                  : "dark:text-icons-3 text-[var(--light-color-text-4)]"
                              }`}
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            : null}
          {isPreparingAnswer && (
            <div className="self-start p-4 w-fit">
              <PulsingDots />
            </div>
          )}
          {/* spacer */}
          <div className="h-20" />
        </div>
      </div>

      {/* Input area */}
      <div className="">
        <form
          onSubmit={handleSubmit}
          className="p-2 border-t border-neutral-200 dark:border-neutral-800"
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
            {isLoading ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={stopGeneration}
                className="relative self-end p-3 bg-red-100 rounded-full transition-colors cursor-pointer dark:bg-red-500/20 dark:ring-red-500/50 dark:ring hover:dark:bg-red-500/30 hover:bg-red-200"
              >
                <Square className="w-1 h-1 text-red-600 fill-current dark:text-red-400" />
              </Button>
            ) : (
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                disabled={inputValue.trim() === ""}
                className="relative self-end p-2 rounded-full cursor-pointer dark:bg-surface-5 bg-[var(--light-color-surface-1)] dark:ring-borders-2 dark:ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowUp className="w-4 h-4 dark:text-accent-green text-[var(--light-green-accent)]" />
              </Button>
            )}
          </div>
        </form>

        {/* Compliance text */}
        <div className="p-2 mt-2 text-center bg-surface-2 dark:bg-surface-5">
          <p className="text-[10px] text-icons-2 dark:text-icons-2">
            Powered by{" "}
            <a
              href="https://kapa.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-accent-green-2 dark:text-accent-green"
            >
              kapa.ai
            </a>
          </p>
          {/* Required disclaimer text */}
          <p className="recaptcha-disclaimer text-[10px] text-icons-2 dark:text-icons-2 mt-1">
            This site is protected by reCAPTCHA and the Google{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-accent-green-2 dark:text-accent-green"
            >
              Privacy Policy
            </a>{" "}
            and{" "}
            <a
              href="https://policies.google.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-accent-green-2 dark:text-accent-green"
            >
              Terms of Service
            </a>{" "}
            apply.
          </p>
        </div>
      </div>
    </div>
  );
}

export default KapaChat;
