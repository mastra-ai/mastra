import { useLocalPathname } from "@docusaurus/theme-common/internal";
import { FeedbackForm } from "./feedback-form";
import { Button } from "./ui/button";
import React, { useState } from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@radix-ui/react-dialog";

export const FeedbackTrigger: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { siteConfig } = useDocusaurusContext();
  const { mastraWebsite } = siteConfig.customFields as {
    mastraWebsite?: string;
  };
  const pathname = useLocalPathname();

  const currentPage = `${mastraWebsite}${pathname}`;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="bg-(--mastra-surface-3) w-full rounded-xl hover:opacity-90 h-8 justify-center flex items-center px-4 text-sm font-normal"
        >
          Share feedback
        </Button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 transition-opacity z-250 bg-black/40" />
        <DialogContent className="dialog-panel data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-260 fixed left-1/2 top-[200px] -translate-x-1/2">
          <div className="flex relative top-1/2 justify-center items-start p-4 min-h-full">
            <div className="ring ring-neutral-200 dark:ring-(--border) shadow-2xl duration-150 ease-out data-closed:transform-[scale(95%)] data-closed:opacity-0 dark:border-(--border) h-fit w-[448px] mx-auto rounded-xl bg-(--ifm-background-color) dark:bg-(--mastra-surface-2) transition-all">
              <DialogTitle className="sr-only">Send Feedback</DialogTitle>
              <div className="w-full">
                <FeedbackForm
                  isOpen={isOpen}
                  onClose={() => setIsOpen(false)}
                  currentPage={currentPage}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};
