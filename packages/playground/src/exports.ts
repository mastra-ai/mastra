// Public exports consumed by @mastra/playground-ui DS components
// This file is the entry point for the @internal/playground package exports

export {
  LinkComponentProvider,
  useLinkComponent,
  type LinkComponentProps,
  type LinkComponent,
  type LinkComponentProviderProps,
} from './lib/framework';

export { PlaygroundQueryClient } from './lib/tanstack-query';
