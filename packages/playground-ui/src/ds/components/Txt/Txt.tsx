import { useRender } from '@base-ui/react/use-render';
import type { ComponentPropsWithoutRef, HTMLAttributes, Ref } from 'react';

import { textStyle } from '@/ds/primitives/text';
import type { TextStyleProps } from '@/ds/primitives/text';
import { cn } from '@/lib/utils';

type TextElement =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'p'
  | 'span'
  | 'label'
  | 'div'
  | 'a'
  | 'button'
  | 'pre'
  | 'strong'
  | 'b'
  | 'li'
  | 'summary'
  | 'dt'
  | 'dd'
  | 'dl'
  | 'nav'
  | 'section'
  | 'ul'
  | 'th'
  | 'table'
  | 'details'
  | 'time'
  | 'input'
  | 'textarea';

export interface TxtProps extends HTMLAttributes<HTMLElement>, TextStyleProps {
  as?: TextElement;
  ref?: Ref<HTMLElement>;
  htmlFor?: string;
  render?: useRender.RenderProp;
}

type ElementTxtProps<T extends TextElement> = TextStyleProps & {
  as?: T;
  ref?: Ref<HTMLElement>;
  htmlFor?: string;
  render?: useRender.RenderProp;
} & Omit<ComponentPropsWithoutRef<T>, keyof TextStyleProps | 'as' | 'ref'>;

/** The element supplies semantics; the role supplies the complete text style. */
export function Txt<T extends TextElement = 'p'>({
  as,
  className,
  variant = 'body',
  tone,
  font,
  render,
  ...props
}: ElementTxtProps<T>) {
  return useRender({
    render,
    defaultTagName: as ?? 'p',
    props: {
      ...props,
      className: cn(textStyle({ variant, tone, font }), className),
    },
  });
}
