import { useThreadsExplorer } from '../../hooks/use-threads-explorer';
import { ThreadsExplorerBody } from '../threads-explorer-body';
import type { ThreadsExplorerBodyProps } from '../threads-explorer-body';

type StudioThreadsExplorerBodyProps = Pick<
  ThreadsExplorerBodyProps,
  'selectedThreadId' | 'onSelectedThreadChange' | 'urlState'
>;

/** The threads body wired the way Studio wires it: `useThreadsExplorer` loads everything through the client. */
export function StudioThreadsExplorerBody({ urlState, ...props }: StudioThreadsExplorerBodyProps) {
  const explorer = useThreadsExplorer(urlState);
  return <ThreadsExplorerBody {...explorer} {...props} renderPanel={() => null} />;
}
