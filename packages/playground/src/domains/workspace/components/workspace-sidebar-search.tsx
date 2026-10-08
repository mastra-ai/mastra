import { useWorkspaceContext } from '@mastra/playground-ui/domains/workspace/components/use-workspace-context';
import { SidebarSearchInput } from '@/components/ui/sidebar-search-input';

/** Search stays in its own full-width row instead of replacing file actions. */
export function WorkspaceSidebarSearch() {
  const { query, setQuery, setSearching, searchFiles, searchSkills } = useWorkspaceContext();
  if (!searchFiles && !searchSkills) return null;
  const placeholder =
    searchFiles && searchSkills ? 'Search files and skills…' : searchFiles ? 'Search files…' : 'Search skills…';
  return (
    <SidebarSearchInput
      label="Search workspace"
      placeholder={placeholder}
      value={query}
      onValueChange={value => {
        setQuery(value);
        setSearching(Boolean(value.trim()));
      }}
    />
  );
}
