import {
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { HeartbeatsPage as HeartbeatsPageContent } from '@/domains/heartbeats/components/heartbeats-page';
import { useHeartbeats } from '@/domains/heartbeats/hooks/use-heartbeats';

export default function HeartbeatsPage() {
  const { error } = useHeartbeats();

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="heartbeats" />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="h-full">
        <HeartbeatsPageContent />
      </div>
    </PageLayout>
  );
}
