import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { CopyButton } from '@/ds/components/CopyButton';
import { Txt, TxtProps } from '@/ds/components/Txt';

export interface TruncateProps extends Omit<TxtProps, 'children'> {
  children: string;
  untilChar?: string;
  charCount?: number;
  copy?: boolean;
}

export function Truncate({ children, untilChar, charCount, copy, className, as = 'span', ...txtProps }: TruncateProps) {
  const fullText = children;

  let truncatedText = fullText;
  let isTruncated = false;

  if (untilChar !== undefined) {
    const index = fullText.indexOf(untilChar);
    if (index !== -1) {
      truncatedText = fullText.slice(0, index);
      isTruncated = true;
    }
  } else if (charCount !== undefined && fullText.length > charCount) {
    truncatedText = fullText.slice(0, charCount);
    isTruncated = true;
  }

  if (!isTruncated) {
    return (
      <Txt as={as} className={className} {...txtProps}>
        {fullText}
      </Txt>
    );
  }

  return (
    <Txt as={as} className={cn('group inline-flex items-center gap-1', className)} {...txtProps}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Txt as="span" className="cursor-default" variant={txtProps.variant} font={txtProps.font}>
            {truncatedText}...
          </Txt>
        </TooltipTrigger>
        <TooltipContent>{fullText}</TooltipContent>
      </Tooltip>
      {copy && (
        <CopyButton content={fullText} iconSize="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </Txt>
  );
}
