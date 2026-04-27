/**
 * @mastra/browser-viewer
 *
 * Browser viewer for Mastra workspaces with CLI provider support.
 * Launches Chrome via Playwright and exposes CDP URL for CLI tools.
 */

export { BrowserViewer } from './browser-viewer';
export { BrowserViewerThreadManager } from './thread-manager';
export type { BrowserViewerConfig, CLIProvider } from './types';
export type { BrowserViewerThreadManagerConfig } from './thread-manager';
