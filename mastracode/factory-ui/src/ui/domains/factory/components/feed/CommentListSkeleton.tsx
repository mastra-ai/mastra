import {
  Comment,
  CommentItem,
  CommentItemAvatar,
  CommentItemContent,
  CommentItemHeader,
} from '@mastra/playground-ui/components/Comment';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

export function CommentListSkeleton() {
  return (
    <div role="status" aria-label="Loading comments" className="px-1 py-1">
      <Comment variant="thread" aria-hidden>
        {Array.from({ length: 3 }, (_, index) => (
          <CommentItem key={index}>
            <CommentItemAvatar>
              <Skeleton className="size-avatar-sm rounded-full motion-reduce:before:animate-none" />
            </CommentItemAvatar>
            <CommentItemContent>
              <CommentItemHeader>
                <Skeleton className="h-3 w-24 motion-reduce:before:animate-none" />
                <Skeleton className="h-2.5 w-10 motion-reduce:before:animate-none" />
              </CommentItemHeader>
              <SkeletonText line="text-caption" className="w-full motion-reduce:before:animate-none" />
              <SkeletonText line="text-caption" className="w-2/3 motion-reduce:before:animate-none" />
            </CommentItemContent>
          </CommentItem>
        ))}
      </Comment>
    </div>
  );
}
