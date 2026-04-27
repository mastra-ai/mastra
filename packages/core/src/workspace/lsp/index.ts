// Types (browser-safe)
export type { CustomLSPServer, LSPConfig, LSPDiagnostic, DiagnosticSeverity, LSPServerDef } from './types';

// Language mapping (browser-safe)
export { LANGUAGE_EXTENSIONS, getLanguageId } from './language';

// Runtime classes (Node.js only)
export { isLSPAvailable, loadLSPDeps, LSPClient } from './client';
export {
  BUILTIN_SERVERS,
  buildCustomExtensions,
  buildServerDefs,
  findProjectRoot,
  findProjectRootAsync,
  getServersForFile,
  walkUp,
  walkUpAsync,
} from './servers';
export { LSPManager } from './manager';
