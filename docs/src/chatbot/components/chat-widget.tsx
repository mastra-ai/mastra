"use client";
import { CopilotKit, useCopilotChat } from "@copilotkit/react-core";
import { Markdown } from "@copilotkit/react-ui";
import { Role, TextMessage } from "@copilotkit/runtime-client-gql";
import { usePostHog } from "posthog-js/react";
import { StickToBottom } from "use-stick-to-bottom";

import { ArrowLeftIcon } from "@/components/svgs/Icons";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import "@copilotkit/react-ui/styles.css";
import { ArrowUp } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

interface ResponseData {
  response: string;
  conversation_id: string;
  question_id?: string;
  original_question?: string;
}

const DocsChat: React.FC<{
  setIsAgentMode: (isAgentMode: boolean) => void;
  searchQuery: string;
}> = ({ setIsAgentMode, searchQuery }) => {
  return (
    <CopilotKit
      runtimeUrl={
        process.env.NODE_ENV === "production"
          ? "/docs/api/copilotkit"
          : "/api/copilotkit"
      }
      showDevConsole={false}
      // agent lock to the relevant agent
      agent="docsAgent"
    >
      <CustomChatInterface
        setIsAgentMode={setIsAgentMode}
        searchQuery={searchQuery}
      />
    </CopilotKit>
  );
};

export function CustomChatInterface({
  setIsAgentMode,
  searchQuery,
}: {
  setIsAgentMode: (isAgentMode: boolean) => void;
  searchQuery: string;
}) {
  const { visibleMessages, appendMessage, isLoading } = useCopilotChat();
  const posthog = usePostHog();

  const [inputValue, setInputValue] = useState("");
  const processedQueryRef = useRef(""); // Track processed queries
  const conversationIdRef = useRef<string>(); // Track conversation ID
  const pendingQuestionRef = useRef<{ id: string; question: string } | null>(
    null,
  ); // Track pending question waiting for response
  const previouslyLoadingRef = useRef(false); // Track previous loading state
  const lastResponseCapturedRef = useRef<string>(""); // Track last captured response to avoid duplicates

  // Initialize conversation ID on first render
  useEffect(() => {
    if (!conversationIdRef.current) {
      conversationIdRef.current = `conversation_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }
  }, []);

  const trackQuestion = (question: string) => {
    const questionId = `question_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    posthog?.capture("DOCS_CHATBOT_QUESTION", {
      question,
      question_id: questionId,
      conversation_id: conversationIdRef.current,
    });

    // Store the pending question for response linking
    pendingQuestionRef.current = { id: questionId, question };
  };

  useEffect(() => {
    if (searchQuery === "" || processedQueryRef.current === searchQuery) return;

    // Track that we've processed this query
    processedQueryRef.current = searchQuery;

    // Track the question
    trackQuestion(searchQuery);

    appendMessage(new TextMessage({ content: searchQuery, role: Role.User }));
  }, [searchQuery, appendMessage, posthog]);

  // Track responses when streaming is complete
  useEffect(() => {
    // Only capture response when loading changes from true to false (streaming complete)
    if (previouslyLoadingRef.current && !isLoading) {
      // Find the most recent assistant message
      const lastAssistantMessage = [...visibleMessages]
        .reverse()
        .find(
          (message) => "role" in message && message.role === Role.Assistant,
        );

      if (lastAssistantMessage) {
        const messageContent =
          "content" in lastAssistantMessage
            ? String(lastAssistantMessage.content)
            : "";

        // Only capture if we have content and haven't captured this exact response before
        if (
          messageContent.trim() &&
          messageContent !== lastResponseCapturedRef.current
        ) {
          // Link response to the pending question
          const responseData: ResponseData = {
            response: messageContent,
            conversation_id: conversationIdRef.current || "",
          };

          if (pendingQuestionRef.current) {
            responseData.question_id = pendingQuestionRef.current.id;
            responseData.original_question =
              pendingQuestionRef.current.question;

            // Clear the pending question after linking
            pendingQuestionRef.current = null;
          }

          posthog?.capture("DOCS_CHATBOT_RESPONSE", responseData);
          lastResponseCapturedRef.current = messageContent;
        }
      }
    }

    // Update previous loading state
    previouslyLoadingRef.current = isLoading;
  }, [isLoading, visibleMessages, posthog]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() === "") return;

    // Track the question
    trackQuestion(inputValue);

    // Send the message
    appendMessage(new TextMessage({ content: inputValue, role: Role.User }));
    setInputValue("");
  };

  const handleBackToSearch = () => {
    setIsAgentMode(false);
  };

  return (
    <div className="flex flex-col w-full h-[600px]">
      {/* Chat header */}
      <div className="flex p-5 w-full">
        <Button
          variant="ghost"
          className="cursor-pointer hover:bg-surface-6 dark:text-icons-3 text-[var(--light-color-text-4)] dark:bg-surface-5 bg-[var(--light-color-surface-4)]"
          size="slim"
          onClick={handleBackToSearch}
        >
          <ArrowLeftIcon className="w-3 h-3" />
          Back to Search
        </Button>
      </div>

      {/* Messages container */}
      <StickToBottom
        className="flex-1 overflow-auto [&>div]:scrollbar-thin"
        resize="smooth"
      >
        <StickToBottom.Content className="p-4">
          {visibleMessages.map((message) => {
            // Check if 'role' exists on message and if it equals Role.User
            const isUser = "role" in message && message.role === Role.User;
            const isAssistant =
              "role" in message && message.role === Role.Assistant;

            // Check if 'content' exists on message, if so use it, otherwise use empty string
            const messageContent: string =
              "content" in message ? String(message.content) : "";

            if (!isAssistant && !isUser) {
              return null;
            }

            return (
              <div
                key={message.id}
                className={`mb-4 w-full flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                {isUser && (
                  <div className="px-4 text-[13px] py-2 rounded-lg max-w-[80%] dark:bg-surface-3 bg-[var(--light-color-surface-4)] dark:text-icons-6 text-[var(--light-color-text-4)]  rounded-br-none">
                    {messageContent}
                  </div>
                )}
                {isAssistant && (
                  <div className="px-4 text-[13px] py-2 bg-transparent relative w-full dark:text-icons-6 text-[var(--light-color-text-4)]">
                    <Markdown content={messageContent} />
                  </div>
                )}
              </div>
            );
          })}
        </StickToBottom.Content>
      </StickToBottom>

      {/* Input area */}
      <div className="p-4">
        <form
          onSubmit={handleSendMessage}
          className="border-t dark:border-borders-2 border-[var(--light-border-code)] "
        >
          <div className="flex items-center">
            <Textarea
              id="custom-chat-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (inputValue.trim() === "" || isLoading) return;
                  // Track the question

                  trackQuestion(inputValue);

                  // Submit the form on Enter
                  appendMessage(
                    new TextMessage({ content: inputValue, role: Role.User }),
                  );
                  setInputValue("");
                }
              }}
              placeholder="Enter your message..."
              className="border-none shadow-none resize-none dark:text-icons-6 text-[var(--light-color-text-4)] placeholder:text-icons-2 focus-visible:ring-0"
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

export default DocsChat;
