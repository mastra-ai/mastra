import React from 'react';

import { cn } from '../lib/utils';

interface PromptSuggestionsProps {
  label: string;
  append: (message: { role: 'user'; content: string }) => void;
  suggestions: string[];
  memoryIsPresent?: boolean;
}

export function PromptSuggestions({ append, suggestions, memoryIsPresent }: PromptSuggestionsProps) {
  return (
    <div className="flex gap-6 text-sm">
      {suggestions.map(suggestion => (
        <button
          type="button"
          key={suggestion}
          onClick={() => append({ role: 'user', content: suggestion })}
          className="h-max rounded-[0.4rem] bg-[#141414] p-4 py-[0.6rem]"
        >
          <span
            className={cn('text-[#939393] transition-colors hover:text-white', memoryIsPresent ? 'text-xs' : 'text-sm')}
          >
            {suggestion}
          </span>
        </button>
      ))}
    </div>
  );
}
