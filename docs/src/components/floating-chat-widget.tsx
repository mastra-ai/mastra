"use client";

import { KapaChat } from "@/chatbot/components/chat-widget";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { KapaProvider } from "@kapaai/react-sdk";
import { MessageCircle } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";
import { Button } from "./ui/button";

export const FloatingChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const posthog = usePostHog();

  function open() {
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
  }

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
              source: "floating_widget",
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
              source: "floating_widget",
            });
          },
        },
      }}
    >
      {/* Floating button */}
      <Button
        onClick={open}
        className="fixed right-6 bottom-6 z-50 w-14 h-14 rounded-full shadow-lg transition-all duration-200 cursor-pointer bg-accent-green-2 hover:bg-accent-green-2/90 dark:bg-accent-green dark:hover:bg-accent-green/90 hover:scale-110"
        aria-label="Open AI chat"
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </Button>

      {/* Chat Dialog */}
      <Dialog
        open={isOpen}
        as="div"
        className="relative z-1000 focus:outline-none"
        onClose={close}
      >
        <DialogBackdrop className="fixed inset-0 transition duration-150 ease-out data-closed:opacity-0 bg-black/40 dark:bg-black/70" />
        <div className="overflow-y-auto fixed inset-0 z-10 w-screen">
          <div className="flex items-start pt-[100px] justify-center min-h-full p-4">
            <DialogPanel
              transition
              className="w-full shadow-2xl overflow-hidden ring ring-neutral-200 dark:ring-neutral-800 max-w-[560px] mx-auto rounded-xl bg-[var(--light-color-surface-15)] dark:bg-surface-4 transition duration-150 ease-out data-closed:transform-[scale(95%)] data-closed:opacity-0"
            >
              <DialogTitle as="h3" className="sr-only">
                AI Chat Assistant
              </DialogTitle>

              {/* Chat content */}
              <div className="w-full">
                <KapaChat close={close} />
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </KapaProvider>
  );
};
