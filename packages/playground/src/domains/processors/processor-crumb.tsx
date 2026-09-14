import { CrumbSkeleton } from '@mastra/playground-ui/components/Breadcrumb';
import { useParams } from 'react-router';
import { ProcessorCombobox } from './components/processor-combobox';
import { useProcessors } from './hooks/use-processors';

export function ProcessorCrumb() {
  const { processorId } = useParams<{ processorId: string }>();
  const { data: processors, isLoading } = useProcessors();
  if (!processorId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return processors?.[processorId]?.name || processorId;
}

export function ProcessorSwitcherAction() {
  const { processorId } = useParams<{ processorId: string }>();
  if (!processorId) return null;

  return <ProcessorCombobox value={processorId} variant="ghost" size="icon-sm" aria-label="Switch processor" />;
}
