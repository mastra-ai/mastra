import { Badge } from '@mastra/playground-ui';
import { Globe, Lock } from 'lucide-react';

export function VisibilityBadge({
  visibility,
  authorId,
  size = 'md',
  className,
}: {
  visibility?: string | null;
  authorId?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';
  // Unowned resources (no authorId) are treated as public per COR-837
  const isPublic = visibility === 'public' || !authorId;
  return (
    <span className={className}>
      <Badge icon={isPublic ? <Globe className={iconSize} /> : <Lock className={iconSize} />}>
        {isPublic ? 'Public' : 'Private'}
      </Badge>
    </span>
  );
}
