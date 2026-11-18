import { ChatShell } from '@mastra/playground-ui/components/ChatShell';
import { Message } from '@mastra/playground-ui/components/Message';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

const TURNS = [
  { ask: 'w-56', reply: ['w-full', 'w-full', 'w-3/4'] },
  { ask: 'w-40', reply: ['w-full', 'w-5/6', 'w-full', 'w-2/5'] },
  { ask: 'w-64', reply: ['w-full', 'w-11/12', 'w-1/2'] },
];

const barClass = 'max-w-full motion-reduce:before:animate-none';

export function TranscriptLoading() {
  return (
    <div role="status" aria-label="Loading messages" className="flex flex-col">
      {TURNS.map(({ ask, reply }) => (
        <ChatShell.Turn key={ask} aria-hidden>
          <Message from="user">
            <SkeletonText line="text-body" className={cn(barClass, ask)} />
          </Message>
          <Message from="assistant">
            <div className="my-3 flex flex-col">
              {reply.map((width, line) => (
                <SkeletonText key={line} line="text-body" className={cn(barClass, width)} />
              ))}
            </div>
          </Message>
        </ChatShell.Turn>
      ))}
    </div>
  );
}
