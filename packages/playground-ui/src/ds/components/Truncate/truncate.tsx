import { CopyButton } from '@/ds/components/CopyButton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import type { TxtElement, TxtProps } from '@/ds/components/Txt';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export type TruncateProps<TElement extends TxtElement = 'span'> = Omit<TxtProps<TElement>, 'children'> & {
  children: string;
  untilChar?: string;
  charCount?: number;
  copy?: boolean;
  withTooltip?: boolean;
};

export function Truncate<TElement extends TxtElement = 'span'>({
  children,
  untilChar,
  charCount,
  copy,
  withTooltip = true,
  className,
  as,
  ...txtProps
}: TruncateProps<TElement>) {
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
      <Txt as={as ?? 'span'} className={className} {...txtProps}>
        {fullText}
      </Txt>
    );
  }

  const truncatedContent = (
    <Txt as="span" className="cursor-default" variant={txtProps.variant} font={txtProps.font}>
      {truncatedText}...
    </Txt>
  );

  return (
    <Txt as={as ?? 'span'} className={cn('group inline-flex items-center gap-1', className)} {...txtProps}>
      {withTooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{truncatedContent}</TooltipTrigger>
          <TooltipContent>{fullText}</TooltipContent>
        </Tooltip>
      ) : (
        truncatedContent
      )}
      {copy && <CopyButton content={fullText} className="opacity-0 transition-opacity group-hover:opacity-100" />}
    </Txt>
  );
}
