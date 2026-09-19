import { GitFork } from 'lucide-react';

import { useThreadBranches } from '@/domains/memory/hooks';
import { useLinkComponent } from '@/lib/framework';

interface AgentMemoryBranchesProps {
  agentId: string;
  threadId: string;
}

/**
 * Shared-history lineage for the current thread: a link back to the parent when
 * this thread is a branch, and the list of direct child branches forked from it.
 * Hidden entirely when the configured memory does not support branching.
 */
export function AgentMemoryBranches({ agentId, threadId }: AgentMemoryBranchesProps) {
  const { Link, paths } = useLinkComponent();
  const { data } = useThreadBranches({ threadId, agentId });

  if (!data?.isSupported) return null;
  const { parentThread, branches } = data;
  if (!parentThread && branches.length === 0) return null;

  return (
    <div className="border-border1 border-b p-4">
      <h3 className="text-neutral5 text-ui-md font-medium">Branches</h3>
      {parentThread && (
        <div className="mt-2">
          <Link
            href={paths.agentThreadLink(agentId, parentThread.id)}
            className="text-neutral3 text-ui-sm hover:text-neutral5 flex items-center gap-1"
          >
            <GitFork className="h-3 w-3" aria-hidden />
            Branched from {parentThread.title ?? parentThread.id}
          </Link>
        </div>
      )}
      {branches.length > 0 && (
        <ul className="mt-2 flex min-w-0 flex-col gap-1">
          {branches.map(({ thread, branch }) => (
            <li key={thread.id} className="min-w-0">
              <Link
                href={paths.agentThreadLink(agentId, thread.id)}
                className="text-neutral5 text-ui-sm hover:text-neutral4 block truncate"
              >
                {thread.title ?? thread.id}
              </Link>
              <span className="text-neutral3 text-ui-xs">
                Forked {new Date(branch.branchCreatedAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
