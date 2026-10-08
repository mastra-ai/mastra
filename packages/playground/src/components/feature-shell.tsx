import { useContext } from 'react';
import { FeatureNavigationContent } from './feature-navigation-content';
import { FeatureShellFrame } from './feature-shell-frame';
import type { FeatureShellFrameProps } from './feature-shell-frame';
import { FeatureWorkspaceContext } from './feature-workspace-context';

/** Primitive navigation is composed into the persistent router-owned frame. */
export function FeatureShell(props: FeatureShellFrameProps) {
  const workspace = useContext(FeatureWorkspaceContext);
  if (!workspace) return <FeatureShellFrame {...props} />;
  return <FeatureNavigationContent {...props} />;
}
