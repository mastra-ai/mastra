import { useMemo } from 'react';
import type { Control } from 'react-hook-form';

import type { AgentEditorConfig } from '../../context/agent-edit-form-context';
import type { AgentFormValues } from '../agent-edit-page/utils/form-validation';

import { isActive } from './agent-cms-is-active';
import { AGENT_CMS_SECTIONS, getCodeAgentOverrideSections } from './agent-cms-sections';
import type { AgentCmsSection } from './agent-cms-sections';
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
  isCodeAgentOverride?: boolean,
  editorConfig?: AgentEditorConfig,
): AgentCmsNavigation {
  const descriptions = useSidebarDescriptions(control);
  const sections: AgentCmsSection[] = isCodeAgentOverride
    ? getCodeAgentOverrideSections(editorConfig)
    : AGENT_CMS_SECTIONS;

  const currentIndex = useMemo(
    () => sections.findIndex((section: AgentCmsSection) => isActive(basePath, currentPath, section.pathSuffix)),
    [basePath, currentPath, sections],
  );

  return useMemo(() => {
    const previous =
      currentIndex > 0
        ? {
            name: sections[currentIndex - 1].name,
            href: basePath + sections[currentIndex - 1].pathSuffix,
          }
        : null;

    const next =
      currentIndex >= 0 && currentIndex < sections.length - 1
        ? {
            name: sections[currentIndex + 1].name,
            href: basePath + sections[currentIndex + 1].pathSuffix,
          }
        : null;

    const currentSection = currentIndex >= 0 ? sections[currentIndex] : null;
    const isNextDisabled = currentSection?.required
      ? !descriptions[currentSection.descriptionKey as keyof typeof descriptions].done
      : false;

    return { previous, next, isNextDisabled };
  }, [currentIndex, basePath, descriptions, sections]);
}
