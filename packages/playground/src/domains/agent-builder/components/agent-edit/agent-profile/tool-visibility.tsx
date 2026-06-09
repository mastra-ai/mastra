import type { ReactNode } from 'react';
import type { AgentTool } from '../../../types/agent-tool';
import { BUILT_IN_TOOLKIT_ID } from './use-provider-toolkit-groups';

export const toolkitOf = (item: AgentTool): string =>
  item.type === 'integration' && item.toolkit ? item.toolkit : BUILT_IN_TOOLKIT_ID;

export function getVisibleTools(
  availableAgentTools: AgentTool[],
  search: string,
  onlySelected: boolean,
  selectedToolkits: Set<string> | null,
): AgentTool[] {
  const term = search.trim().toLowerCase();

  return availableAgentTools.filter(item => {
    if (selectedToolkits !== null && !selectedToolkits.has(toolkitOf(item))) return false;
    if (onlySelected && !item.isChecked) return false;
    if (!term) return true;
    return item.name.toLowerCase().includes(term) || (item.description?.toLowerCase().includes(term) ?? false);
  });
}

export function getEmptyStateDetails(args: {
  allToolkitsUnchecked: boolean;
  onlySelected: boolean;
  search: string;
}): ReactNode {
  const trimmedSearch = args.search.trim();
  if (args.allToolkitsUnchecked) {
    return 'Select at least one toolkit to see tools';
  }
  if (args.onlySelected && trimmedSearch === '') {
    return 'No tools selected yet';
  }
  if (args.onlySelected) {
    return <>No selected tools match {trimmedSearch}</>;
  }
  return (
    <>
      No tools match <strong>{trimmedSearch}</strong>
    </>
  );
}
