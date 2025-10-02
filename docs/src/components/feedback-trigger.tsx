"use client";

import { FeedbackForm } from "@/components/feedback-form";
import { Button } from "@/components/ui/button";
import { T } from "gt-next/client";
import { usePathname } from "next/navigation";
import React, { useState } from "react";

export const FeedbackTrigger: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  return (
    <div>
      {!isOpen ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpen}
          className="dark:bg-[#121212]  bg-[var(--light-color-surface-3)] w-full rounded-md hover:opacity-90 h-[32px] justify-center flex items-center px-4 text-[var(--light-color-text-5)] dark:text-white text-[14px]"
        >
          <T id="_locale_.layout.feedback">Question? Give us feedback</T>
        </Button>
      ) : (
        <FeedbackForm
          isOpen={isOpen}
          onClose={handleClose}
          currentPage={pathname}
        />
      )}
    </div>
  );
};
