import { Icon } from '@/components/icon';

import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { cn } from '@/lib/utils';

import { Button } from './button';

export const CopyButton = ({ snippet, classname }: { snippet: string; classname?: string }) => {
  const [_, CopyFn, isCodeBlockCopied] = useCopyToClipboard();

  return (
    <Button
      type="button"
      onClick={() => CopyFn(snippet)}
      variant={'secondary'}
      className={cn('w-6 h-6 bg-mastra-bg-4 border border-mastra-border-2 p-0', classname)}
    >
      {isCodeBlockCopied ? (
        <Icon name="check" className="text-white w-4 h-4" />
      ) : (
        <Icon name="copy" className="text-white w-4 h-4" />
      )}
    </Button>
  );
};
