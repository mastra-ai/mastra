import type { LinkComponent, LinkComponentProps } from '@mastra/playground-ui/lib/framework';
import { forwardRef } from 'react';
import { Link as RouterLink, useLocation } from 'react-router';
import { isSamePageHref } from './same-page-href';

// Routes served by the Hono server, not the React Router SPA.
// These need full-page navigation via a plain <a> tag.
const SERVER_ROUTE_PREFIXES = ['/swagger-ui', '/openapi.json'];

export const Link: LinkComponent = forwardRef<HTMLAnchorElement, LinkComponentProps>(
  ({ children, href, ...props }, ref) => {
    const { pathname } = useLocation();
    const isServerRoute = href && SERVER_ROUTE_PREFIXES.some(prefix => href.startsWith(prefix));

    if (isServerRoute) {
      return (
        <a ref={ref} href={href} {...props}>
          {children}
        </a>
      );
    }

    return (
      <RouterLink ref={ref} to={href ?? ''} viewTransition={!isSamePageHref(href ?? '', pathname)} {...props}>
        {children}
      </RouterLink>
    );
  },
);
