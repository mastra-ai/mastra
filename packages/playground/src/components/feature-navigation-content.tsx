import { useContext, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import type { FeatureShellFrameProps } from './feature-shell-frame';
import { FeatureWorkspaceContext } from './feature-workspace-context';

/** The primitive contributes content and delegates view shortcuts to the shared panel. */
export function FeatureNavigationContent({ sidebar, children, navigationRef }: FeatureShellFrameProps) {
  const workspace = useContext(FeatureWorkspaceContext);
  useImperativeHandle(
    navigationRef,
    () => ({
      collapse: () => workspace?.handle.current?.collapse(),
      expand: () => workspace?.handle.current?.expand(),
      toggle: () => workspace?.handle.current?.toggle(),
    }),
    [workspace],
  );
  return (
    <>
      {workspace && createPortal(sidebar, workspace.target)}
      {children}
    </>
  );
}
