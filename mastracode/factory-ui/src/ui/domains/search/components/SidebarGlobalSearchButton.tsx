import { GlobalSearchButton } from './GlobalSearchButton';

// Hidden in the mobile drawer — the chat header owns the trigger at that width
export function SidebarGlobalSearchButton() {
  return <GlobalSearchButton id="global-search-sidebar-trigger" className="hidden md:inline-flex" />;
}
