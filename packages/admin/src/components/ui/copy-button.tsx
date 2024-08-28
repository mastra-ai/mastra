import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';

import { Button } from './button';

export const CopyButton = ({ snippet, classname }: { snippet: string; classname?: string }) => {
  const [_, CopyFn, isCodeBlockCopied] = useCopyToClipboard();

  return (
    <Button
      type="button"
      onClick={() => CopyFn(snippet)}
      variant={'secondary'}
      className={cn('w-7 h-7 border border-arkw-border-1 p-0', classname)}
    >
      {isCodeBlockCopied ? (
        <Icon name="check" className="text-white " />
      ) : (
        <Icon name="clipboard" className="text-white " />
      )}
    </Button>
  );
};
