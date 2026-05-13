import { useParams } from 'react-router';
import { ProcessorCombobox } from './components/processor-combobox';

export function ProcessorCrumb() {
  const { processorId } = useParams<{ processorId: string }>();
  if (!processorId) return null;

  return <ProcessorCombobox value={processorId} variant="ghost" />;
}
