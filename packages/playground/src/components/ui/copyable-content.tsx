import { Copy } from 'lucide-react';

import { cn } from '@/lib/utils';

import { Button } from './button';

interface CopyableCell {
  content: string;
  label: string;
  multiline?: boolean;
}

export function CopyableContent({ content, label, multiline = false }: CopyableCell) {
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="group relative flex items-start gap-2">
      <span className={cn('text-sm text-mastra-el-4', multiline ? 'whitespace-pre-wrap' : 'truncate')}>{content}</span>
      <Button
        variant="ghost"
        size="sm"
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -mt-1"
        onClick={e => {
          e.stopPropagation();
          handleCopy();
        }}
        aria-label={`Copy ${label}`}
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}
