import { prefersReducedMotion } from "@docusaurus/theme-common";
import clsx from "clsx";
import React, { type ReactNode, useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";

import { Markdown } from "@copilotkit/react-ui";
import { useChat } from "@kapaai/react-sdk";
import { PulsingDots } from "@site/src/components/loading";
import { Button } from "@site/src/components/ui/button";
import { Textarea } from "@site/src/components/ui/textarea";
import {
  ArrowUp,
  PanelLeftClose,
  PanelRightClose,
  Square,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useStickToBottom } from "use-stick-to-bottom";
import styles from "./styles.module.css";
import { cn } from "@site/src/lib/utils";

interface ChatbotSidebarProps {
  hiddenChatbotSidebar: boolean;
  setHiddenChatbotSidebar: (
    value: boolean | ((prev: boolean) => boolean),
  ) => void;
}

export default function ChatbotSidebar({
  hiddenChatbotSidebar,
  setHiddenChatbotSidebar,
}: ChatbotSidebarProps): ReactNode {
  const [hiddenSidebar, setHiddenSidebar] = useState(false);

  const toggleSidebar = useCallback(() => {
    if (hiddenSidebar) {
      setHiddenSidebar(false);
    }
    // onTransitionEnd won't fire when sidebar animation is disabled
    // fixes https://github.com/facebook/docusaurus/issues/8918
    if (!hiddenSidebar && prefersReducedMotion()) {
      setHiddenSidebar(true);
    }
    setHiddenChatbotSidebar((value) => !value);
  }, [setHiddenChatbotSidebar, hiddenSidebar]);

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
  const isDisabled = inputValue.trim() === "" || isLoading;

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

  // Set global CSS variable when chatbot sidebar open/close state changes
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--chatbot-sidebar-open",
      hiddenChatbotSidebar ? "0" : "1",
    );
  }, [hiddenChatbotSidebar]);

  return (
    <motion.aside
      layout
      initial={false}
      className={clsx(
        styles.chatbotSidebarContainer,
        hiddenChatbotSidebar && styles.chatbotSidebarContainerHidden,
      )}
      transition={{
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      }}
      onAnimationComplete={() => {
        if (hiddenChatbotSidebar) {
          setHiddenSidebar(true);
        }
      }}
    >
      <div
        className={clsx(
          styles.sidebarViewport,
          hiddenSidebar && styles.sidebarViewportHidden,
        )}
      >
        {/* Clickable border for collapsing */}
        <div
          className="absolute top-0 bottom-0 -left-2 w-4 h-full cursor-col-resize z-100"
          onClick={toggleSidebar}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              toggleSidebar();
            }
          }}
          title={hiddenChatbotSidebar ? "Expand chatbot" : "Collapse chatbot"}
          aria-label={
            hiddenChatbotSidebar ? "Expand chatbot" : "Collapse chatbot"
          }
        />
        {/* Sidebar content */}
        <div className={styles.chatbotContent} ref={scrollRef}>
          <div
            className={cn(
              "sticky top-0 backdrop-blur-md justify-start bg-(--mastra-surface-1)/50 z-10 flex items-center gap-2 px-3  py-2 pt-1 -mx-[10px]",
              !hiddenChatbotSidebar && "border-b border-(--border)",
            )}
          >
            <button
              className="hover:bg-(--mastra-surface-5) w-fit p-1.5 rounded-lg cursor-pointer"
              onClick={toggleSidebar}
            >
              {!hiddenChatbotSidebar ? (
                <PanelRightClose className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
            {!hiddenChatbotSidebar && (
              <span className="text-sm font-medium text-(--mastra-text-tertiary)">
                Chat with Mastra docs
              </span>
            )}
          </div>
          {!hiddenChatbotSidebar && (
            <>
              <div
                ref={contentRef}
                className="flex flex-col flex-1 gap-8 h-full"
              >
                {conversation.length > 0
                  ? conversation.map(
                      ({ answer: a, question: q, id, reaction }) => {
                        return (
                          <div
                            key={id}
                            className={`flex flex-col gap-8 w-full`}
                          >
                            {!!q && (
                              <div className="px-2 self-end ring ring-(--border-subtle) text-sm py-1 rounded-lg max-w-[80%] dark:bg-surface-3 dark:text-icons-6 text-(--light-color-text-4) rounded-br-none">
                                {q}
                              </div>
                            )}

                            {!!a && (
                              <div className="relative text-sm bg-transparent max-w-full dark:text-icons-6 text-[--light-color-text-4]">
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
                                      onClick={() =>
                                        handleFeedback(id, "upvote")
                                      }
                                      className={`p-1 cursor-pointer ${
                                        reaction === "upvote"
                                          ? "dark:text-(--mastra-green-accent) text-(--mastra-green-accent)"
                                          : "dark:text-icons-3 text-(--mastra-text-tertiary)"
                                      }`}
                                    >
                                      <ThumbsUp className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() =>
                                        handleFeedback(id, "downvote")
                                      }
                                      className={`p-1 cursor-pointer ${
                                        reaction === "downvote"
                                          ? "dark:text-red-500 text-red-600"
                                          : "dark:text-icons-3 text-(--mastra-text-tertiary)"
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
                      },
                    )
                  : null}
                {isPreparingAnswer && (
                  <div className="self-start p-4 w-fit">
                    <PulsingDots />
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 space-y-2.5 z-10 pt-2 bg-(--mastra-surface-1)">
                <form
                  className="flex p-3 flex-col bg-(--ifm-background-color) rounded-xl border border-(--border) focus-within:border-green-500 focus-within:ring-2 focus-within:ring-(--mastra-green-accent)/50"
                  onSubmit={handleSubmit}
                >
                  <Textarea
                    className="overflow-hidden font-medium placeholder:text-(--mastra-text-muted) placeholder:font-medium p-0 w-full text-sm border-none shadow-none outline-none resize-none text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                    rows={1}
                    placeholder="Ask questions about Mastra..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <div className="flex justify-end w-full">
                    {!isLoading ? (
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        disabled={isDisabled}
                        className="self-end bg-black rounded-full ring-offset-1 ring-offset-white cursor-pointer ring-3 will-change-transform hover:bg-black/90 dark:bg-white dark:hover:bg-white/90 hover:scale-105 ring-black/10"
                      >
                        <ArrowUp className="w-4 h-4 text-white dark:text-black" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={stopGeneration}
                        className="self-end bg-black rounded-full ring-offset-1 ring-offset-white cursor-pointer ring-3 will-change-transform hover:bg-black/90 dark:bg-white dark:hover:bg-white/90 hover:scale-105 ring-black/10"
                      >
                        <Square className="w-3 h-3 text-white fill-white dark:text-black" />
                      </Button>
                    )}
                  </div>
                </form>

                <div className="flex items-center -mx-[10px] py-2 px-3 border-t border-(--border)">
                  <span className="text-xs font-medium text-(--mastra-text-muted)">
                    Powered by{" "}
                    <a
                      href="https://www.kapa.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      kapa.ai
                    </a>
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
