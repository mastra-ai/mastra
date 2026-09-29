import { crumbSwitcherTriggerProps } from '@mastra/playground-ui/components/Breadcrumb';
import { useParams } from 'react-router';
import { ToolCombobox } from './components/tool-combobox';

export function ToolCrumb() {
  const { toolId } = useParams<{ toolId: string }>();
  return toolId ?? null;
}

export function ToolSwitcher() {
  const { toolId } = useParams<{ toolId: string }>();
  if (!toolId) return null;

  return <ToolCombobox value={toolId} {...crumbSwitcherTriggerProps} aria-label="Switch tool" />;
}
