import { useLocalPathname } from "@docusaurus/theme-common/internal";
import { FeedbackForm } from "./feedback-form";
import { Button } from "./ui/button";
import React, { useState } from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

export const FeedbackTrigger: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { siteConfig } = useDocusaurusContext();
  const { mastraWebsite } = siteConfig.customFields as {
    mastraWebsite?: string;
  };
  const pathname = useLocalPathname();

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  const currentPage = `${mastraWebsite}${pathname}`;

  return (
    <div>
      {!isOpen ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpen}
          className="bg-(--mastra-surface-3) w-full rounded-xl hover:opacity-90 h-8 justify-center flex items-center px-4 text-sm font-normal"
        >
          Share feedback
        </Button>
      ) : (
        <FeedbackForm
          isOpen={isOpen}
          onClose={handleClose}
          currentPage={currentPage}
        />
      )}
    </div>
  );
};
