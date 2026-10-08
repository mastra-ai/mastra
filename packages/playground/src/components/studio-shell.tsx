import { Outlet } from 'react-router';
/** Routes without contextual navigation use the full Studio frame. */
export function StudioShell() {
  return <Outlet />;
}
