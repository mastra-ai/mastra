"use client";
import { CopilotKit, useCopilotChat } from "@copilotkit/react-core";
import { Markdown } from "@copilotkit/react-ui";
import { Role, TextMessage } from "@copilotkit/runtime-client-gql";

import { ArrowLeftIcon, PaperIcon } from "@/components/svgs/Icons";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import Spinner from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import "@copilotkit/react-ui/styles.css";
import { ArrowUp } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

const DocsChat: React.FC<{
  setIsAgentMode: (isAgentMode: boolean) => void;
  searchQuery: string;
}> = ({ setIsAgentMode, searchQuery }) => {
  return (
    <CopilotKit
      runtimeUrl={process.env.NODE_ENV === "production" ? "/docs/api/copilotkit" : "/api/copilotkit"}
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
  const { visibleMessages, appendMessage, isLoading, reset } = useCopilotChat();

  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log({searchQuery})
    if (searchQuery === "") return;
    appendMessage(new TextMessage({ content: searchQuery, role: Role.User }));
  }, [searchQuery]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() === "") return;

    // Send the message
    appendMessage(new TextMessage({ content: inputValue, role: Role.User }));
    setInputValue("");
  };

  const handleNewChat = () => {
    reset();
  };

  const handleBackToSearch = () => {
    setIsAgentMode(false);
  };

  return (
    <div className="flex flex-col w-full h-[600px]">
      {/* Chat header */}
      <div className="flex justify-between w-full p-5">
        <Button
          variant="ghost"
          className="cursor-pointer hover:bg-surface-6 text-icons-3 bg-surface-5"
          size="slim"
          onClick={handleBackToSearch}
        >
          <ArrowLeftIcon className="w-3 h-3" />
          Back to Search
        </Button>
        <Button
          variant="ghost"
          className="cursor-pointer hover:bg-surface-6 text-icons-3 bg-surface-5"
          size="slim"
          onClick={handleNewChat}
        >
          <PaperIcon className="w-6 h-6" />
          New chat
        </Button>
      </div>

      {/* Messages container */}
      <ScrollArea className="relative flex-1 w-full h-full p-4">
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
                <div className="px-4 text-[13px] py-2 rounded-lg max-w-[80%] bg-surface-3 text-icons-6 rounded-br-none">
                  {messageContent}
                </div>
              )}
              {isAssistant && (
                <div className="px-4 text-[13px] py-2 bg-transparent relative w-full text-icons-6">
                  <Markdown content={messageContent} />
                </div>
              )}
            </div>
          );
        })}
        {/* {isLoading && <ActivityIcon />} */}
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Input area */}
      <div className="p-4 ">
        <form
          onSubmit={handleSendMessage}
          className="border-t border-borders-1"
        >
          <div className="flex items-center">
            <Textarea
              id="custom-chat-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (inputValue.trim() !== '') {
                    // Submit the form on Enter
                    appendMessage(new TextMessage({ content: inputValue, role: Role.User }));
                    setInputValue('');
                  }
                }
                // Shift+Enter will create a new line (default behavior)
              }}
              placeholder="Enter your message..."
              className="border-none shadow-none resize-none text-icons-6 placeholder:text-icons-2 focus-visible:ring-0"
            />
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              disabled={isLoading || inputValue.trim() === ""}
              className="relative self-end p-2 rounded-full cursor-pointer bg-surface-5 ring-borders-2 ring"
            >
              {isLoading ? <Spinner /> : <ArrowUp className="w-4 h-4 text-accent-green" />}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DocsChat;
