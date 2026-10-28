import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { FactoryOnboarding } from './FactoryOnboarding';

export function EmptyFactoryState() {
  const auth = useFactoryAuth();
  if (auth.isPending) return <SkeletonRows label="Loading Factory setup" rows={3} />;
  if (auth.isError) {
    return (
      <div className="p-6">
        <Txt role="alert">Unable to load your account.</Txt>
        <Button onClick={() => void auth.refetch()}>Retry</Button>
      </div>
    );
  }
  return <FactoryOnboarding local={!auth.data.authEnabled} />;
}
