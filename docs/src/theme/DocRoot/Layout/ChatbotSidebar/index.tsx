import { Markdown } from "@copilotkit/react-ui";
import { prefersReducedMotion } from "@docusaurus/theme-common";
import { useChat } from "@kapaai/react-sdk";
import { PulsingDots } from "@site/src/components/loading";
import { Button } from "@site/src/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@site/src/components/ui/conversation";
import { Textarea } from "@site/src/components/ui/textarea";
import { cn } from "@site/src/lib/utils";
import clsx from "clsx";
import {
  ArrowUp,
  PanelLeftClose,
  PanelRightClose,
  Square,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import React, {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useChatbotSidebar } from "./context";
import styles from "./styles.module.css";
import { TextShimmer } from "./text-shimmer";

function LeftClickableBorder({
  onClick,
  hiddenChatbotSidebar,
  onMouseDown,
}: {
  onClick: (e: React.MouseEvent) => void;
  hiddenChatbotSidebar: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className="absolute top-0 bottom-0 -left-2 w-4 h-full cursor-col-resize z-100"
      onClick={onClick}
      onMouseDown={onMouseDown}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick(e as unknown as React.MouseEvent);
        }
      }}
      title={hiddenChatbotSidebar ? "Expand chatbot" : "Collapse chatbot"}
      aria-label={hiddenChatbotSidebar ? "Expand chatbot" : "Collapse chatbot"}
    />
  );
}

export default function ChatbotSidebar() {
  const { isHidden: hiddenChatbotSidebar, toggle } = useChatbotSidebar();
  const [hiddenSidebar, setHiddenSidebar] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Width constants (kept in sync with CSS defaults)
  const SIDEBAR_MIN_WIDTH = 250;
  const SIDEBAR_MAX_WIDTH = 600;
  const SIDEBAR_DEFAULT_WIDTH = 400;

  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const hasDraggedRef = useRef(false);
  const startXRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hiddenChatbotSidebar) {
      // Use setTimeout to ensure the textarea is rendered and ready
      const timeoutId = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [hiddenChatbotSidebar]);

  const toggleSidebar = useCallback(() => {
    if (hiddenSidebar) {
      setHiddenSidebar(false);
    }
    // onTransitionEnd won't fire when sidebar animation is disabled
    // fixes https://github.com/facebook/docusaurus/issues/8918
    if (!hiddenSidebar && prefersReducedMotion()) {
      setHiddenSidebar(true);
    }
    toggle();
  }, [toggle, hiddenSidebar]);

  // Click wrapper: only toggle if the pointer interaction wasn't a drag
  const handleToggleClick = useCallback(
    (e: React.MouseEvent) => {
      if (hasDraggedRef.current) return;
      toggleSidebar();
    },
    [toggleSidebar],
  );

  // Handle drag to resize sidebar
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    hasDraggedRef.current = false;
    startXRef.current = e.clientX;
    setIsDragging(true);
    // disable transitions for main/sidebar while dragging
    document.documentElement.style.setProperty(
      "--chatbot-transition-duration",
      "0s",
    );
    // set cursor globally
    document.body.style.cursor = "col-resize";
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!sidebarRef.current) return;

      const startX = startXRef.current ?? e.clientX;
      const moved = Math.abs(e.clientX - startX);
      if (moved > 0) {
        hasDraggedRef.current = true;
      }

      const newWidth = window.innerWidth - e.clientX;

      if (newWidth >= SIDEBAR_MIN_WIDTH && newWidth <= SIDEBAR_MAX_WIDTH) {
        setSidebarWidth(newWidth);
        document.documentElement.style.setProperty(
          "--chatbot-sidebar-width",
          `${newWidth}px`,
        );
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      startXRef.current = null;
      // restore transitions and cursor
      document.documentElement.style.setProperty(
        "--chatbot-transition-duration",
        "0.3s",
      );
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.documentElement.style.setProperty(
        "--chatbot-transition-duration",
        "0.3s",
      );
    };
  }, [isDragging, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH]);

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
      // Refocus textarea after submission
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) {
        submitQuery(inputValue);
        setInputValue("");
        // Refocus textarea after submission
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 0);
      }
    }
  };

  const handleFeedback = (
    questionAnswerId: string,
    reaction: "upvote" | "downvote",
  ) => {
    addFeedback(questionAnswerId, reaction);
  };

  // Set global CSS variable when chatbot sidebar open/close state changes
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--chatbot-sidebar-open",
      hiddenChatbotSidebar ? "0" : "1",
    );
  }, [hiddenChatbotSidebar]);

  return (
    <aside
      ref={sidebarRef}
      className={clsx(
        styles.chatbotSidebarContainer,
        hiddenChatbotSidebar && styles.chatbotSidebarContainerHidden,
        isDragging && "select-none",
      )}
      style={!hiddenChatbotSidebar ? { width: `${sidebarWidth}px` } : undefined}
    >
      <LeftClickableBorder
        onClick={handleToggleClick}
        hiddenChatbotSidebar={hiddenChatbotSidebar}
        onMouseDown={handleMouseDown}
      />

      {hiddenChatbotSidebar ? (
        <div
          className={cn(
            "backdrop-blur-md relative h-full justify-start bg-(--ifm-navbar-background-color) z-10 flex flex-col items-center gap-2 px-2 py-2 pt-1",
          )}
        >
          <button
            className={cn(
              "hover:bg-(--mastra-surface-1) w-fit p-1.5 absolute top-1/2 -translate-y-1/2 h-fit rounded-lg cursor-pointer",
            )}
            onClick={toggleSidebar}
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      ) : null}

      {!hiddenChatbotSidebar && (
        <div className="flex flex-col h-[calc(100%-165px)] ">
          <p className="text-sm p-3 z-200 items-center flex backdrop-blur-md bg-white/50 dark:bg-black py-2 absolute w-full top-0 border-b-[0.5px] border-(--border) font-medium text-(--mastra-text-tertiary)">
            <button
              className={cn(
                "hover:bg-(--mastra-surface-1) w-fit p-1.5 rounded-lg cursor-pointer",
              )}
              onClick={toggleSidebar}
            >
              <PanelRightClose className="size-3" />
            </button>
            <span>Chat with Mastra docs</span>
          </p>
          <Conversation className="mt-[41px] flex-1 relative font-sans overflow-y-auto">
            <ConversationContent>
              {conversation.length > 0
                ? conversation.map(
                    ({ answer: a, question: q, id, reaction }) => {
                      return (
                        <div key={id} className={`flex flex-col gap-8 w-full`}>
                          {!!q && (
                            <div className="px-2 self-end bg-(--mastra-surface-3) text-sm py-1 rounded-xl max-w-[80%] dark:bg-surface-3 dark:text-icons-6 text-(--light-color-text-4)">
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
                                    onClick={() => handleFeedback(id, "upvote")}
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
                <TextShimmer className="font-mono text-xs" duration={2}>
                  Generating answer...
                </TextShimmer>
              )}
            </ConversationContent>
            <ConversationScrollButton className="bg-white/50 backdrop-blur-lg dark:bg-black/50 border-none ring-1 ring-(--border-subtle)" />
          </Conversation>
        </div>
      )}
      {!hiddenChatbotSidebar && (
        <div className="space-y-2.5 bg-(--ifm-navbar-background-color) backdrop-blur-lg z-10 pt-2 px-2">
          <form
            className="flex p-3 shadow-[0px_10px_24px_-6px_#0000001a,0px_2px_4px_-1px_#0000000f,0_0_0_1px_#54483114]  flex-col bg-(--ifm-background-color) rounded-2xl border border-(--border) focus-within:border-green-500 focus-within:ring-2 focus-within:ring-(--mastra-green-accent)/50"
            onSubmit={handleSubmit}
          >
            <Textarea
              className="overflow-hidden font-medium placeholder:text-(--mastra-text-muted) placeholder:font-medium p-0 w-full text-sm border-none shadow-none outline-none resize-none text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
              placeholder="Ask questions about Mastra..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              ref={textareaRef}
              autoFocus
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
          <div className="flex items-end pt-0  pb-3 px-3">
            <span className="text-[11px] ml-auto inline-block font-medium dark:text-(--mastra-text-tertiary) text-(--mastra-text-muted-2)!">
              Powered by{" "}
              <a
                href="https://kapa.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="dark:text-(--mastra-text-tertiary) text-(--mastra-text-muted-2)!"
              >
                kapa.ai
              </a>
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
