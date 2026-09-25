// Public exports for the @internal/playground package
// Store and workspace-compat are re-exported from playground-ui (canonical source)

export {
  LinkComponentProvider,
  useLinkComponent,
  type LinkComponentProps,
  type LinkComponent,
  type LinkComponentProviderProps,
} from '@mastra/playground-ui/lib/framework';

export { PlaygroundQueryClient } from './lib/tanstack-query';
export { usePlaygroundStore } from '@/store/playground-store';
export { useTheme, type Theme, type ResolvedTheme } from '@mastra/playground-ui/components/ThemeProvider';

export { isWorkspaceV1Supported } from '@mastra/playground-ui/utils/workspace-compat';
