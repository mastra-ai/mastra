import type { LinkComponent, LinkComponentProps } from '@mastra/playground-ui/lib/framework';
import { forwardRef } from 'react';
import { Link as RouterLink } from 'react-router';

// Routes served by the Hono server, not the React Router SPA.
// These need full-page navigation via a plain <a> tag.
const SERVER_ROUTE_PREFIXES = ['/swagger-ui', '/openapi.json'];

export const Link: LinkComponent = forwardRef<HTMLAnchorElement, LinkComponentProps>(
  ({ children, href, ...props }, ref) => {
    const isServerRoute = href && SERVER_ROUTE_PREFIXES.some(prefix => href.startsWith(prefix));

    if (isServerRoute) {
      return (
        <a ref={ref} href={href} {...props}>
          {children}
        </a>
      );
    }

    return (
      <RouterLink ref={ref} to={href ?? ''} viewTransition {...props}>
        {children}
      </RouterLink>
    );
  },
);

export const Sup = () => {
  return (
    <Workspace.Root>
      <Workspace.Aside>
        {/* expandable using collapse panel (i think tha's the name) */}
        <Workspace.AsideHeader>
          <Workspace.Search /> {/* <-- starts search of both files and skills */}
        </Workspace.AsideHeader>
        <Workspace.Tree /> {/* clickingon that thing shows the selected file in the file viewer */}
      </Workspace.Aside>

      <Workspace.ActiveFile>
        <Workspace.ActiveFileHeader>
          {' '}
          {/* <-- shows the selected file */}
          <Workspace.FilePath /> {/* <-- shows the path of the selected file */}
        </Workspace.ActiveFileHeader>
      </Workspace.ActiveFile>
    </Workspace.Root>
  );
};
