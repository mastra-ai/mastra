'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useWindowSize } from 'usehooks-ts';

import type { UISuggestion } from '@/lib/editor/suggestions';

import { CrossIcon, MessageIcon } from './icons';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { ArtifactKind } from './artifact';

export const Suggestion = ({
  suggestion,
  onApply,
  artifactKind,
}: {
  suggestion: UISuggestion;
  onApply: () => void;
  artifactKind: ArtifactKind;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { width: windowWidth } = useWindowSize();

  return (
    <AnimatePresence>
      {!isExpanded ? (
        <motion.div
          className={cn('cursor-pointer text-muted-foreground p-1', {
            'absolute -right-8': artifactKind === 'text',
            'sticky top-0 right-4': artifactKind === 'code',
          })}
          onClick={() => {
            setIsExpanded(true);
          }}
          whileHover={{ scale: 1.1 }}
        >
          <MessageIcon size={windowWidth && windowWidth < 768 ? 16 : 14} />
        </motion.div>
      ) : (
        <motion.div
          key={suggestion.id}
          className="absolute bg-background p-3 flex flex-col gap-3 rounded-2xl border text-sm w-56 shadow-xl z-50 -right-12 md:-right-16 font-sans"
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: -20 }}
          exit={{ opacity: 0, y: -10 }}
          whileHover={{ scale: 1.05 }}
        >
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center gap-2">
              <div className="size-4 bg-muted-foreground/25 rounded-full" />
              <div className="font-medium">Assistant</div>
            </div>
            <button
              type="button"
              className="text-xs text-gray-500 cursor-pointer"
              onClick={() => {
                setIsExpanded(false);
              }}
            >
              <CrossIcon size={12} />
            </button>
          </div>
          <div>{suggestion.description}</div>
          <Button variant="outline" className="w-fit py-1.5 px-3 rounded-full" onClick={onApply}>
            Apply
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
