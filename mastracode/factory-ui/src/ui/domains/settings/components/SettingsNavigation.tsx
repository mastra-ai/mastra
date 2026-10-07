import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Sidebar, useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Brain,
  Building2,
  Cable,
  CircleUserRound,
  GitBranch,
  Inbox,
  Palette,
  SlidersHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useCloseSettings } from '../hooks/useCloseSettings';
import { useSettingsSection } from '../hooks/useSettingsSection';
import { SETTINGS_SECTION_LABELS, settingsSectionPath, type SettingsSection } from '../settingsSections';

type SettingsNavItem = {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  searchText: string;
};

type SettingsNavGroup = {
  id: string;
  label?: string;
  ariaLabel?: string;
  items: SettingsNavItem[];
};

const SETTINGS_GROUPS: SettingsNavGroup[] = [
  {
    id: 'personal',
    label: 'Your settings',
    items: [
      {
        id: 'account',
        label: SETTINGS_SECTION_LABELS.account,
        icon: CircleUserRound,
        searchText: 'my account profile identity email authentication session log out sign out user',
      },
      {
        id: 'preferences',
        label: SETTINGS_SECTION_LABELS.preferences,
        icon: Palette,
        searchText: 'preferences general theme appearance color scheme completion sound',
      },
      {
        id: 'personal-models',
        label: SETTINGS_SECTION_LABELS['personal-models'],
        icon: Bot,
        searchText: 'your personal models default model api keys providers credentials sign in oauth',
      },
      {
        id: 'memory',
        label: SETTINGS_SECTION_LABELS.memory,
        icon: Brain,
        searchText:
          'your personal memory observational recall observer reflector thresholds attachments summarize context',
      },
      {
        id: 'connections',
        label: SETTINGS_SECTION_LABELS.connections,
        icon: Cable,
        searchText: 'your personal connections connected accounts slack communication integrations',
      },
    ],
  },
  {
    id: 'factory',
    label: 'Factory settings',
    items: [
      {
        id: 'models',
        label: SETTINGS_SECTION_LABELS.models,
        icon: Bot,
        searchText:
          'factory shared models thinking level default api keys providers credentials sign in oauth custom endpoints',
      },
      {
        id: 'factory-memory',
        label: SETTINGS_SECTION_LABELS['factory-memory'],
        icon: Brain,
        searchText:
          'factory shared memory observational recall observer reflector thresholds attachments summarize context',
      },
      {
        id: 'skills',
        label: SETTINGS_SECTION_LABELS.skills,
        icon: BookOpen,
        searchText: 'skills factory triage plan review agent instructions prompts stages',
      },
      {
        id: 'behavior',
        label: SETTINGS_SECTION_LABELS.behavior,
        icon: SlidersHorizontal,
        searchText: 'behavior auto approve tools smart editing notifications permissions read edit execute mcp',
      },
      {
        id: 'repositories',
        label: SETTINGS_SECTION_LABELS.repositories,
        icon: GitBranch,
        searchText: 'repositories source control git branches remotes code worktrees sandbox setup github',
      },
      {
        id: 'intake',
        label: SETTINGS_SECTION_LABELS.intake,
        icon: Inbox,
        searchText: 'work intake sources tasks issues pull requests github linear feed sync',
      },
      {
        id: 'factory',
        label: SETTINGS_SECTION_LABELS.factory,
        icon: Building2,
        searchText: 'factory project organization manage remove delete danger',
      },
    ],
  },
];

export function SettingsNavigation() {
  const section = useSettingsSection();
  const { factoryId } = useParams<{ factoryId: string }>();
  const location = useLocation();
  const closeSettings = useCloseSettings();
  const { state } = useSidebar();
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredGroups = SETTINGS_GROUPS.map(group => ({
    ...group,
    items: normalizedQuery ? group.items.filter(({ searchText }) => searchText.includes(normalizedQuery)) : group.items,
  })).filter(group => group.items.length > 0);

  if (!factoryId) return null;

  return (
    <>
      <Sidebar.NavList>
        <Sidebar.NavLink asChild link={{ name: 'Back to app', url: '#', icon: <ArrowLeft /> }}>
          <button type="button" aria-label="Back to app" onClick={closeSettings}>
            <ArrowLeft aria-hidden="true" />
            <Sidebar.NavLabel>Back to app</Sidebar.NavLabel>
          </button>
        </Sidebar.NavLink>
      </Sidebar.NavList>
      {state === 'default' && (
        <div className="py-2">
          <SearchInput label="Search settings" placeholder="Search settings…" value={query} onValueChange={setQuery} />
        </div>
      )}
      {filteredGroups.length > 0 ? (
        filteredGroups.map(group => {
          const headerId = group.label ? `settings-${group.id}` : undefined;
          return (
            <Sidebar.NavSection
              key={group.id}
              aria-labelledby={headerId}
              aria-label={headerId ? undefined : (group.ariaLabel ?? group.id)}
            >
              {group.label && <Sidebar.NavHeader id={headerId}>{group.label}</Sidebar.NavHeader>}
              <Sidebar.NavList>
                {group.items.map(({ id, label, icon: Icon }) => {
                  const isActive = section === id;
                  return (
                    <Sidebar.NavLink
                      key={id}
                      asChild
                      isActive={isActive}
                      link={{ name: label, url: '#', icon: <Icon /> }}
                    >
                      <Link
                        to={settingsSectionPath(factoryId, id)}
                        state={location.state}
                        aria-label={label}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon aria-hidden="true" />
                        <Sidebar.NavLabel>{label}</Sidebar.NavLabel>
                      </Link>
                    </Sidebar.NavLink>
                  );
                })}
              </Sidebar.NavList>
            </Sidebar.NavSection>
          );
        })
      ) : (
        <Txt as="p" variant="caption" role="status" className="px-3 py-2">
          No settings found.
        </Txt>
      )}
    </>
  );
}
