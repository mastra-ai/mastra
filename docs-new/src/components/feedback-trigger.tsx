import { useLocalPathname } from '@docusaurus/theme-common/internal';
import { FeedbackForm } from './feedback-form';
import { Button } from './ui/button';
import React, { useState } from 'react';

export const FeedbackTrigger: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = useLocalPathname();

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  return (
    <div>
      {!isOpen ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpen}
          className="dark:bg-[#121212]  bg-(--mastra-surface-3) w-full rounded-[10px] hover:opacity-90 h-[32px] justify-center flex items-center px-4 text-[var(--light-color-text-5)] dark:text-white text-[14px]"
        >
          Question? Give us feedback
        </Button>
      ) : (
        <FeedbackForm isOpen={isOpen} onClose={handleClose} currentPage={pathname} />
      )}
    </div>
  );
};
