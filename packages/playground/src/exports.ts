// Public exports for the @internal/playground package
// Store and workspace-compat are re-exported from playground-ui (canonical source)

export {
  LinkComponentProvider,
  useLinkComponent,
  type LinkComponentProps,
  type LinkComponent,
  type LinkComponentProviderProps,
} from './lib/framework';

export { PlaygroundQueryClient } from './lib/tanstack-query';

export { usePlaygroundStore, useIsDarkMode, type PlaygroundTheme } from '@mastra/playground-ui';

export { isWorkspaceV1Supported } from '@mastra/playground-ui/utils';
