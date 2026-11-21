import { useSpansExplorer } from '../../hooks/use-spans-explorer';
import { SpansExplorerBody } from '../spans-explorer-body';
import type { SpansExplorerBodyProps } from '../spans-explorer-body';

type StudioSpansExplorerBodyProps = Pick<
  SpansExplorerBodyProps,
  'selection' | 'onSelectionChange' | 'renderPanel' | 'urlState'
>;

/** The spans body wired the way Studio wires it: `useSpansExplorer` loads everything through the client. */
export function StudioSpansExplorerBody({ urlState, ...props }: StudioSpansExplorerBodyProps) {
  const explorer = useSpansExplorer(urlState);
  return <SpansExplorerBody {...explorer} {...props} />;
}
