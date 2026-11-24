import { forwardRef } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import { Link } from 'react-router';

export const HrefLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ href = '', ...props }, ref) => <Link ref={ref} to={href} {...props} />,
);
HrefLink.displayName = 'HrefLink';
