import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { Outlet, useNavigate, Link as RouterLink } from 'react-router';
import { LinkComponentProvider } from '@/lib/framework';
import { Layout } from '@/components/layout';
import { paths } from '@/App';

/**
 * Studio's sidebar/nav components render `<LinkComponent href="/x">` (anchor
 * shape). React-router's own `Link` only performs SPA navigation when given
 * `to`, and preventDefaults `href`-only clicks — so passing it raw here means
 * every sidebar click looks active but never actually navigates.
 *
 * Bridge that by mapping `href → to` so SPA nav works and modifier-clicks
 * still open in a new tab (react-router Link handles that internally).
 */
const StudioAnchorLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
  function StudioAnchorLink({ href, ...rest }, ref) {
    return <RouterLink ref={ref} to={href ?? '#'} {...rest} />;
  },
);

/**
 * Portal's root layout — mounts the full Studio chrome (Layout) with the
 * navigation helpers Studio pages expect. Everything inside <Layout> is
 * genuine playground code — real pages, real components, real hooks.
 */
export function PortalRootLayout() {
  const navigate = useNavigate();
  const frameworkNavigate = (path: string) => navigate(path);

  return (
    <div className="studio-portal-scope h-full w-full">
      <LinkComponentProvider Link={StudioAnchorLink} navigate={frameworkNavigate} paths={paths}>
        <Layout>
          <Outlet />
        </Layout>
      </LinkComponentProvider>
    </div>
  );
}
