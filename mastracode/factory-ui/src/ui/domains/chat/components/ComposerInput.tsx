import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { cn } from '@mastra/playground-ui/utils/cn';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';

export type ComposerVariant = 'inline' | 'textarea';

const composerVariantClass: Record<ComposerVariant, string> = {
  inline: 'field-sizing-content max-h-52 min-h-10 resize-none',
  textarea: 'field-sizing-content max-h-64 min-h-28 resize-none',
};

type ComposerInputProps = ComponentPropsWithoutRef<typeof Textarea> & {
  composerVariant?: ComposerVariant;
};

export const ComposerInput = forwardRef<HTMLTextAreaElement, ComposerInputProps>(
  ({ composerVariant = 'inline', className, ...props }, ref) => (
    <Textarea ref={ref} {...props} className={cn(composerVariantClass[composerVariant], className)} />
  ),
);
