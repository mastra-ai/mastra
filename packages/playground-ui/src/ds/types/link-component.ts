import type { AnchorHTMLAttributes, ForwardRefExoticComponent, RefAttributes } from 'react';

export type LinkComponentProps = AnchorHTMLAttributes<HTMLAnchorElement>;

export type LinkComponent = ForwardRefExoticComponent<LinkComponentProps & RefAttributes<HTMLAnchorElement>>;
