import { InputGroup, InputGroupAddon, InputGroupInput } from '@mastra/playground-ui/components/InputGroup';
import { MainSidebar, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowLeft, Brain, GitBranch, Key, Palette, Search, Server, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';

import { useActiveFactoryContext } from '../../workspaces/context/ActiveFactoryProvider';
import { useCloseSettings } from '../hooks/useCloseSettings';
import { useSettingsSection } from '../hooks/useSettingsSection';
import { SETTINGS_SECTION_LABELS, settingsSectionPath, type SettingsSection } from '../settingsSections';

const SETTINGS_SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  searchText: string;
}[] = [
  {
    id: 'general',
    label: SETTINGS_SECTION_LABELS.general,
    icon: Palette,
    searchText: 'general theme appearance color scheme completion sound',
  },
  {
    id: 'source-control',
    label: SETTINGS_SECTION_LABELS['source-control'],
    icon: GitBranch,
    searchText: 'source control git branches repositories remotes factories',
  },
  {
    id: 'model',
    label: SETTINGS_SECTION_LABELS.model,
    icon: Search,
    searchText: 'model thinking level factory default model packs packs',
  },
  {
    id: 'memory',
    label: SETTINGS_SECTION_LABELS.memory,
    icon: Brain,
    searchText: 'memory observational recall working memory',
  },
  {
    id: 'behavior',
    label: SETTINGS_SECTION_LABELS.behavior,
    icon: SlidersHorizontal,
    searchText: 'behavior auto approve tools smart editing notifications permissions read edit execute mcp',
  },
  {
    id: 'providers',
    label: SETTINGS_SECTION_LABELS.providers,
    icon: Key,
    searchText: 'api keys providers credentials',
  },
  {
    id: 'custom-providers',
    label: SETTINGS_SECTION_LABELS['custom-providers'],
    icon: Server,
    searchText: 'custom providers endpoints base url',
  },
];

export function SettingsNavigation() {
  const section = useSettingsSection();
  const { activeFactory } = useActiveFactoryContext();
  const location = useLocation();
  const closeSettings = useCloseSettings();
  const { state } = useMainSidebar();
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSections = normalizedQuery
    ? SETTINGS_SECTIONS.filter(({ searchText }) => searchText.includes(normalizedQuery))
    : SETTINGS_SECTIONS;

  return (
    <>
      <MainSidebar.NavList>
        <MainSidebar.NavLink asChild link={{ name: 'Back to app', url: '#', icon: <ArrowLeft /> }}>
          <button type="button" aria-label="Back to app" onClick={closeSettings}>
            <ArrowLeft aria-hidden="true" />
            <MainSidebar.NavLabel>Back to app</MainSidebar.NavLabel>
          </button>
        </MainSidebar.NavLink>
      </MainSidebar.NavList>
      {state === 'default' && (
        <div className="px-1 py-2">
          <InputGroup variant="outline">
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label="Search settings"
              placeholder="Search settings…"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </InputGroup>
        </div>
      )}
      {filteredSections.length > 0 ? (
        <MainSidebar.NavList>
          {filteredSections.map(({ id, label, icon: Icon }) => {
            const isActive = section === id;
            return (
              <MainSidebar.NavLink
                key={id}
                asChild
                isActive={isActive}
                link={{ name: label, url: '#', icon: <Icon /> }}
              >
                <Link
                  to={settingsSectionPath(activeFactory!.id, id)}
                  state={location.state}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon aria-hidden="true" />
                  <MainSidebar.NavLabel>{label}</MainSidebar.NavLabel>
                </Link>
              </MainSidebar.NavLink>
            );
          })}
        </MainSidebar.NavList>
      ) : (
        <Txt as="p" variant="ui-sm" role="status" className="px-3 py-2">
          No settings found.
        </Txt>
      )}
    </>
  );
}
