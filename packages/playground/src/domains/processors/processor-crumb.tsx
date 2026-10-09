import { CrumbSkeleton, crumbSwitcherTriggerProps } from '@mastra/playground-ui/components/Breadcrumb';
import { useProcessors } from '@mastra/react/hooks/processors';
import { useParams } from 'react-router';
import { ProcessorCombobox } from './components/processor-combobox';

export function ProcessorCrumb() {
  const { processorId } = useParams<{ processorId: string }>();
  const { data: processors, isLoading } = useProcessors();
  if (!processorId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return processors?.[processorId]?.name || processorId;
}

export function ProcessorSwitcher() {
  const { processorId } = useParams<{ processorId: string }>();
  if (!processorId) return null;

  return <ProcessorCombobox value={processorId} {...crumbSwitcherTriggerProps} aria-label="Switch processor" />;
}
