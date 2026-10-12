import { HeaderCreateAction } from '@/components/ui/header-create-action';

export function DatasetHeaderCreateAction() {
  return (
    <HeaderCreateAction href="/datasets/new" tooltip="Create a dataset">
      New dataset
    </HeaderCreateAction>
  );
}
