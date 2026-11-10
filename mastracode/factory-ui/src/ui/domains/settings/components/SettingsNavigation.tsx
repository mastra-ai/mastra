import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Sidebar, useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Cable } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useCloseSettings } from '../hooks/useCloseSettings';
import { useSettingsSection } from '../hooks/useSettingsSection';
import { SETTINGS_SECTION_LABELS, settingsSectionPath } from '../settingsSections';
import type { SettingsSection } from '../settingsSections';
import { IconArrowLeft } from '@mastra/playground-ui/icons/central/IconArrowLeft';
import { IconBrain } from '@mastra/playground-ui/icons/central/IconBrain';
import { IconBranch } from '@mastra/playground-ui/icons/central/IconBranch';
import { IconBug } from '@mastra/playground-ui/icons/central/IconBug';
import { IconBuildings } from '@mastra/playground-ui/icons/central/IconBuildings';
import { IconCirclePerson } from '@mastra/playground-ui/icons/central/IconCirclePerson';
import { IconColorPalette } from '@mastra/playground-ui/icons/central/IconColorPalette';
import { IconInboxEmpty } from '@mastra/playground-ui/icons/central/IconInboxEmpty';
import { IconMaintenance } from '@mastra/playground-ui/icons/central/IconMaintenance';
import { IconRobot } from '@mastra/playground-ui/icons/central/IconRobot';
import { IconSettingsSliderHor } from '@mastra/playground-ui/icons/central/IconSettingsSliderHor';

type SettingsNavItem = {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  searchText: string;
};

type SettingsNavGroup = {
  id: string;
  label: string;
  items: SettingsNavItem[];
};

const SETTINGS_GROUPS: SettingsNavGroup[] = [
  {
    id: 'account',
    label: 'Account',
    items: [
      {
        id: 'account',
        label: SETTINGS_SECTION_LABELS.account,
        icon: IconCirclePerson,
        searchText: 'my account profile identity email authentication session log out sign out user',
      },
      {
        id: 'preferences',
        label: SETTINGS_SECTION_LABELS.preferences,
        icon: IconColorPalette,
        searchText: 'preferences general theme appearance color scheme completion sound',
      },
      {
        id: 'connections',
        label: SETTINGS_SECTION_LABELS.connections,
        icon: Cable,
        searchText: 'personal organization connections connected accounts slack integrations github gitlab tokens pat',
      },
    ],
  },
  {
    id: 'agent',
    label: 'Agent',
    items: [
      {
        id: 'models',
        label: SETTINGS_SECTION_LABELS.models,
        icon: IconRobot,
        searchText:
          'models default model your models factory models routing personal factory defaults hybrid thinking level api keys providers credentials sign in oauth custom endpoints',
      },
      {
        id: 'memory',
        label: SETTINGS_SECTION_LABELS.memory,
        icon: IconBrain,
        searchText:
          'memory personal memory factory memory your memory shared memory observational recall observer reflector thresholds attachments summarize context',
      },
      {
        id: 'tools',
        label: SETTINGS_SECTION_LABELS.tools,
        icon: IconMaintenance,
        searchText: 'tools mastra connect connections integrations sessions platform project approval',
      },
      {
        id: 'behavior',
        label: SETTINGS_SECTION_LABELS.behavior,
        icon: IconSettingsSliderHor,
        searchText: 'behavior auto approve tools smart editing notifications permissions read edit execute mcp',
      },
    ],
  },
  {
    id: 'factory',
    label: 'Factory',
    items: [
      {
        id: 'repositories',
        label: SETTINGS_SECTION_LABELS.repositories,
        icon: IconBranch,
        searchText:
          'repositories source control git branches remotes code worktrees clone order pre-clone setup teardown github gitlab',
      },
      {
        id: 'intake',
        label: SETTINGS_SECTION_LABELS.intake,
        icon: IconInboxEmpty,
        searchText:
          'work intake sources tasks issues pull requests github linear feed sync intake routes routing board catch-all',
      },
      {
        id: 'factory',
        label: SETTINGS_SECTION_LABELS.factory,
        icon: IconBuildings,
        searchText:
          'factory project organization manage environment sandbox resources cpu memory workdir workspace setup builds templates triggers remove delete danger',
      },
      {
        id: 'debug',
        label: SETTINGS_SECTION_LABELS.debug,
        icon: IconBug,
        searchText: 'debug versions packages release build node mastra core factory installed running',
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
        <Sidebar.NavLink asChild link={{ name: 'Back to app', url: '#', icon: <IconArrowLeft /> }}>
          <button type="button" aria-label="Back to app" onClick={closeSettings}>
            <IconArrowLeft aria-hidden="true" />
            <Sidebar.NavLabel>Back to app</Sidebar.NavLabel>
          </button>
        </Sidebar.NavLink>
      </Sidebar.NavList>
      {state === 'default' && (
        <div className="py-2">
          <SearchInput label="Search settings" placeholder="Search settings" value={query} onValueChange={setQuery} />
        </div>
      )}
      {filteredGroups.length > 0 ? (
        filteredGroups.map(group => {
          const headerId = `settings-${group.id}`;
          return (
            <Sidebar.NavSection key={group.id} aria-labelledby={headerId}>
              <Sidebar.NavHeader id={headerId}>{group.label}</Sidebar.NavHeader>
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
