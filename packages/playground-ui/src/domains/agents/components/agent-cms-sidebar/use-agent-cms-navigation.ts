import { useMemo } from 'react';
import type { Control } from 'react-hook-form';

import type { AgentFormValues } from '../agent-edit-page/utils/form-validation';

import { AGENT_CMS_SECTIONS } from './agent-cms-sections';
import { isActive } from './agent-cms-is-active';
import { useSidebarDescriptions } from './use-sidebar-descriptions';

interface NavTarget {
  name: string;
  href: string;
}

interface AgentCmsNavigation {
  previous: NavTarget | null;
  next: NavTarget | null;
  isNextDisabled: boolean;
}

export function useAgentCmsNavigation(
  basePath: string,
  currentPath: string,
  control: Control<AgentFormValues>,
): AgentCmsNavigation {
  const descriptions = useSidebarDescriptions(control);

  const currentIndex = useMemo(
    () => AGENT_CMS_SECTIONS.findIndex(section => isActive(basePath, currentPath, section.pathSuffix)),
    [basePath, currentPath],
  );

  return useMemo(() => {
    const previous =
      currentIndex > 0
        ? {
            name: AGENT_CMS_SECTIONS[currentIndex - 1].name,
            href: basePath + AGENT_CMS_SECTIONS[currentIndex - 1].pathSuffix,
          }
        : null;

    const next =
      currentIndex >= 0 && currentIndex < AGENT_CMS_SECTIONS.length - 1
        ? {
            name: AGENT_CMS_SECTIONS[currentIndex + 1].name,
            href: basePath + AGENT_CMS_SECTIONS[currentIndex + 1].pathSuffix,
          }
        : null;

    const currentSection = currentIndex >= 0 ? AGENT_CMS_SECTIONS[currentIndex] : null;
    const isNextDisabled = currentSection?.required ? !descriptions[currentSection.descriptionKey].done : false;

    return { previous, next, isNextDisabled };
  }, [currentIndex, basePath, descriptions]);
}
