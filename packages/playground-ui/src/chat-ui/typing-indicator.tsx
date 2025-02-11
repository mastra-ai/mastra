import { Dot } from 'lucide-react';
import React from 'react';

export function TypingIndicator() {
  return (
    <div className="justify-left flex space-x-1">
      <div className="bg-muted flex items-center gap-1 rounded-lg px-2 py-3">
        <div className="flex -space-x-2.5">
          <Dot className="animate-typing-dot-bounce h-5 w-5" />
          <Dot className="animate-typing-dot-bounce h-5 w-5 delay-200" />
          <Dot className="animate-typing-dot-bounce h-5 w-5 delay-500" />
        </div>
      </div>
    </div>
  );
}
