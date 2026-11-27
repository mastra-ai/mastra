import { forwardRef } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import { Link } from 'react-router';

import { useSettingsLinkState } from '../hooks/useSettingsOpen';

/** `HrefLink` for links into or within Settings: Back to app still returns to the page Settings was opened from. */
export const SettingsHrefLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ href = '', ...props }, ref) => <Link ref={ref} to={href} state={useSettingsLinkState()} {...props} />,
);
SettingsHrefLink.displayName = 'SettingsHrefLink';
