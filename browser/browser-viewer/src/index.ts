/**
 * @mastra/browser-viewer
 *
 * Browser viewer for Mastra workspaces with CLI provider support.
 * Launches Chrome via Playwright and exposes CDP URL for CLI tools.
 */

export { PlaywrightViewer } from './playwright-viewer';
export type { BrowserViewerConfig, CLIProvider } from './types';
