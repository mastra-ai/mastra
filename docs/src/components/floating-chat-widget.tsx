"use client";

import { KapaChat } from "@/chatbot/components/chat-widget";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

export const FloatingChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);

  function open() {
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
  }

  return (
    <>
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
    </>
  );
};
