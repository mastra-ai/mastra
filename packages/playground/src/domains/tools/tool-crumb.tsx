import { useParams } from 'react-router';
import { ToolCombobox } from './components/tool-combobox';

export function ToolCrumb() {
  const { toolId } = useParams<{ toolId: string }>();
  if (!toolId) return null;

  return <ToolCombobox value={toolId} variant="ghost" />;
}
