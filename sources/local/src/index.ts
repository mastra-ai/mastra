// Main provider
export { LocalProjectSource } from './provider';

// Detector
export { MastraProjectDetector, detector } from './detector';

// Scanner
export { DirectoryScanner, scanner } from './scanner';

// Watcher
export { ProjectWatcher } from './watcher';
export type { WatcherOptions } from './watcher';

// Types
export type {
  LocalProjectSourceConfig,
  PackageManager,
  ProjectMetadata,
  LocalProjectSource as LocalProjectSourceType,
  ScanOptions,
  ScanResult,
  ScanError,
  ProjectSource,
  ChangeEvent,
} from './types';

// Utilities
export { generateProjectId, isPathAccessible, isDirectory, resolvePath, getProjectNameFromPath } from './utils';
