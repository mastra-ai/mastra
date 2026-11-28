import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { BoardNavigation } from '..';
import type { IntakeProvider } from '../board-page/board-source-filters';

import type { CanvasFocus } from './canvas-focus';
import type { SourceOption } from './source-options';

export interface BoardSettingsSkill {
  name: string;
  description: string;
  content: string;
  origin?: 'bundled' | 'folder' | 'code' | 'project';
  builtIn?: boolean;
  /** Set when the SKILL.md fails to load; the agent can't use the skill. */
  error?: string;
  edited?: { updatedBy: string; updatedAt: string };
}

export interface BoardSettingsSkills {
  skills: BoardSettingsSkill[];
  canEdit?: boolean;
}

/** What blocks leaving a board's settings with unsaved edits. */
export interface BoardSettingsLeaveGuard {
  blocked: boolean;
  stay: () => void;
  leave: () => void;
}

/**
 * Where the board settings link to and what they read from the app around them. Settings never touch a router or
 * the app's integrations: each host app (Factory, Platform) supplies this.
 */
export interface BoardSettingsHost {
  /** A board's settings, at a phase or with a rule or test open in the side panel. */
  configHref: (boardId: string, phaseKey?: string, focus?: CanvasFocus) => string;
  /** Routing, at the intake order when asked, or with a rule or test open in the side panel. */
  routingHref: (boardId: string, options?: { intakeOrder?: boolean; focus?: CanvasFocus }) => string;
  /** The app's intake settings, where sources are connected. */
  intakeSettingsHref: () => string;
  /** The page's URL hash, which opens Not routed when it names it. */
  hash: string;
  /** Where the project's new issues and pull requests come from; undefined while they load. */
  intakeProviders: readonly IntakeProvider[] | undefined;
  /** A board's cards, in the view the viewer last left it in; `view: 'default'` opens it unfiltered. */
  boardHref: (boardId: string, options?: { view?: 'remembered' | 'default' }) => string;
  /** Where a deleted board's page goes when no other board is left. */
  homeHref: () => string;
  skillHref: (skillName: string) => string;
  skillsHref: () => string;
  newSkillHref: () => string;
  navigate: (href: string, options?: { replace?: boolean }) => void;
  /** The page's search params, where the side panel's rule or test lives. */
  searchParams: URLSearchParams;
  /** Shown before the Cards/Settings/Routing tabs, such as a sidebar toggle. */
  tabsLeading?: ReactNode;
  /** Links within board settings. */
  LinkComponent: BoardNavigation['LinkComponent'];
  /** Links into the app's settings; defaults to the board navigation's link. */
  SettingsLinkComponent?: BoardNavigation['LinkComponent'];
  /** The project's skills; undefined until they load, so no skill is called missing early. */
  skills: BoardSettingsSkills | undefined;
  /** Values `source.repository` takes for the project's items. */
  sourceSuggestions: SourceOption[];
  /**
   * Holds navigation away from this board's settings while `changed()` is true. Leaving for routing counts as leaving.
   * A hook: called once per render of the canvas.
   */
  useLeaveGuard: (boardId: string, changed: () => boolean) => BoardSettingsLeaveGuard;
}

export const BoardSettingsHostContext = createContext<BoardSettingsHost | null>(null);

export function useBoardSettingsHost(): BoardSettingsHost {
  const host = useContext(BoardSettingsHostContext);
  if (!host) throw new Error('useBoardSettingsHost must be used inside a BoardSettingsHostContext provider');
  return host;
}
