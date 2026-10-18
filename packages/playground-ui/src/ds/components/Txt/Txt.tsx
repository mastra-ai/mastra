import { useRender } from '@base-ui/react/use-render';
import type { ComponentPropsWithoutRef, HTMLAttributes, Ref } from 'react';

import { textStyle } from '@/ds/primitives/text';
import type { TextStyleProps } from '@/ds/primitives/text';
import { cn } from '@/lib/utils';

type TextElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'label' | 'strong' | 'b' | 'time';

export interface TxtProps extends HTMLAttributes<HTMLElement>, TextStyleProps {
  as?: TextElement;
  ref?: Ref<HTMLElement>;
  htmlFor?: string;
}

type ElementTxtProps<T extends TextElement> = TextStyleProps & {
  as?: T;
  ref?: Ref<HTMLElement>;
  htmlFor?: string;
} & Omit<ComponentPropsWithoutRef<T>, keyof TextStyleProps | 'as' | 'ref'>;

/** Typography for text elements. Controls and layout containers own their markup. */
export function Txt<T extends TextElement = 'p'>({ as, className, variant, tone, font, ...props }: ElementTxtProps<T>) {
  return useRender({
    defaultTagName: as ?? 'p',
    props: {
      ...props,
      className: cn(
        textStyle({ variant: variant ?? 'body', tone, font }),
        variant === undefined && (as === 'strong' || as === 'b') && 'font-bold',
        className,
      ),
    },
  });
}
