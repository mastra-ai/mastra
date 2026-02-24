/**
 * LSP Client
 *
 * JSON-RPC client wrapper for communicating with language servers.
 * Uses dynamic imports for vscode-jsonrpc and vscode-languageserver-protocol
 * to keep them as optional dependencies.
 *
 * Spawns LSP servers via a SandboxProcessManager, so it works with any
 * sandbox backend (local, E2B, etc.) that has a process manager.
 */

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import type { ProcessHandle, SandboxProcessManager } from '../sandbox/process-manager';
import type { LSPServerDef } from './types';

// =============================================================================
// Dynamic Import
// =============================================================================

/** Cached module references — undefined means not yet checked, null means unavailable */
let jsonrpcModule:
  | {
      StreamMessageReader: any;
      StreamMessageWriter: any;
      createMessageConnection: any;
    }
  | null
  | undefined;
let lspProtocolModule:
  | {
      TextDocumentIdentifier: any;
      Position: any;
    }
  | null
  | undefined;

/**
 * Check if vscode-jsonrpc is available without importing it.
 * Synchronous check — safe to call at registration time.
 */
export function isLSPAvailable(): boolean {
  if (jsonrpcModule !== undefined) {
    return jsonrpcModule !== null;
  }

  try {
    const req = createRequire(import.meta.url);
    req.resolve('vscode-jsonrpc/node');
    req.resolve('vscode-languageserver-protocol');
    return true;
  } catch {
    return false;
  }
}

/**
 * Load vscode-jsonrpc and vscode-languageserver-protocol.
 * Returns null if not available. Caches result after first call.
 */
export async function loadLSPDeps(): Promise<{
  StreamMessageReader: any;
  StreamMessageWriter: any;
  createMessageConnection: any;
  TextDocumentIdentifier: any;
  Position: any;
} | null> {
  if (jsonrpcModule !== undefined && lspProtocolModule !== undefined) {
    if (jsonrpcModule === null || lspProtocolModule === null) return null;
    return { ...jsonrpcModule, ...lspProtocolModule };
  }

  try {
    const req = createRequire(import.meta.url);
    const jsonrpc = req('vscode-jsonrpc/node');
    const protocol = req('vscode-languageserver-protocol');
    jsonrpcModule = {
      StreamMessageReader: jsonrpc.StreamMessageReader,
      StreamMessageWriter: jsonrpc.StreamMessageWriter,
      createMessageConnection: jsonrpc.createMessageConnection,
    };
    lspProtocolModule = {
      TextDocumentIdentifier: protocol.TextDocumentIdentifier,
      Position: protocol.Position,
    };
    return { ...jsonrpcModule, ...lspProtocolModule };
  } catch {
    jsonrpcModule = null;
    lspProtocolModule = null;
    return null;
  }
}

// =============================================================================
// URI Helpers
// =============================================================================

/** Convert a filesystem path to a properly encoded file:// URI. */
function toFileUri(fsPath: string): string {
  return pathToFileURL(fsPath).toString();
}

// =============================================================================
// LSP Client
// =============================================================================

/**
 * Wraps a JSON-RPC connection to a single LSP server process.
 * Uses a SandboxProcessManager to spawn the server process.
 */
export class LSPClient {
  private connection: any = null;
  private handle: ProcessHandle | null = null;
  private serverDef: LSPServerDef;
  private workspaceRoot: string;
  private processManager: SandboxProcessManager;
  private diagnostics: Map<string, any[]> = new Map();
  private initializationOptions: Record<string, unknown> | null = null;

  constructor(serverDef: LSPServerDef, workspaceRoot: string, processManager: SandboxProcessManager) {
    this.serverDef = serverDef;
    this.workspaceRoot = workspaceRoot;
    this.processManager = processManager;
  }

  /** Whether the underlying server process is still running. */
  get isAlive(): boolean {
    return this.handle !== null && this.handle.exitCode === undefined;
  }

  /**
   * Initialize the LSP connection — spawns the server and performs the handshake.
   */
  async initialize(initTimeout: number = 10000): Promise<void> {
    const deps = await loadLSPDeps();
    if (!deps) {
      throw new Error('LSP dependencies (vscode-jsonrpc) are not available');
    }
    const { StreamMessageReader, StreamMessageWriter, createMessageConnection } = deps;

    const command = this.serverDef.command(this.workspaceRoot);
    if (!command) {
      throw new Error('Failed to resolve LSP server command');
    }
    this.handle = await this.processManager.spawn(command, { cwd: this.workspaceRoot });

    const initializationOptions = this.serverDef.initialization?.(this.workspaceRoot);

    const reader = new StreamMessageReader(this.handle.reader);
    const writer = new StreamMessageWriter(this.handle.writer);
    this.connection = createMessageConnection(reader, writer);

    // Silently ignore stream destroyed errors during shutdown
    this.connection.onError(() => {});

    // Listen for published diagnostics
    this.connection.onNotification('textDocument/publishDiagnostics', (params: any) => {
      this.diagnostics.set(params.uri, params.diagnostics);
    });

    this.connection.listen();

    // Build initialize params
    const initParams: any = {
      processId: process.pid,
      rootUri: toFileUri(this.workspaceRoot),
      workspaceFolders: [
        {
          name: 'workspace',
          uri: toFileUri(this.workspaceRoot),
        },
      ],
      capabilities: {
        window: { workDoneProgress: true },
        workspace: { configuration: true },
        textDocument: {
          publishDiagnostics: {
            relatedInformation: true,
            tagSupport: { valueSet: [1, 2] },
            versionSupport: false,
          },
          synchronization: {
            didOpen: true,
            didChange: true,
            dynamicRegistration: false,
            willSave: false,
            willSaveWaitUntil: false,
            didSave: false,
          },
          completion: {
            dynamicRegistration: false,
            completionItem: {
              snippetSupport: false,
              commitCharactersSupport: false,
              documentationFormat: ['markdown', 'plaintext'],
              deprecatedSupport: false,
              preselectSupport: false,
            },
          },
          definition: { dynamicRegistration: false, linkSupport: true },
          typeDefinition: { dynamicRegistration: false, linkSupport: true },
          implementation: { dynamicRegistration: false, linkSupport: true },
          references: { dynamicRegistration: false },
          documentHighlight: { dynamicRegistration: false },
          documentSymbol: { dynamicRegistration: false, hierarchicalDocumentSymbolSupport: true },
          codeAction: {
            dynamicRegistration: false,
            codeActionLiteralSupport: {
              codeActionKind: {
                valueSet: [
                  'quickfix',
                  'refactor',
                  'refactor.extract',
                  'refactor.inline',
                  'refactor.rewrite',
                  'source',
                  'source.organizeImports',
                ],
              },
            },
          },
          hover: { dynamicRegistration: false, contentFormat: ['markdown', 'plaintext'] },
        },
      },
    };

    if (initializationOptions) {
      initParams.initializationOptions = initializationOptions;
      this.initializationOptions = initializationOptions;
    }

    // Handle workspace/configuration requests
    this.connection.onRequest('workspace/configuration', (params: any) => {
      return params.items?.map(() => ({})) || [];
    });

    // Handle window/workDoneProgress/create requests
    this.connection.onRequest('window/workDoneProgress/create', () => null);

    let initTimer: ReturnType<typeof setTimeout>;
    await Promise.race([
      this.connection.sendRequest('initialize', initParams),
      new Promise((_, reject) => {
        initTimer = setTimeout(() => reject(new Error('LSP initialize request timed out')), initTimeout);
      }),
    ]).finally(() => clearTimeout(initTimer!));

    // Send initialized notification
    this.connection.sendNotification('initialized', {});

    // Send workspace/didChangeConfiguration
    this.connection.sendNotification('workspace/didChangeConfiguration', {
      settings: this.initializationOptions ?? {},
    });
  }

  /**
   * Notify the server that a document has been opened.
   */
  notifyOpen(filePath: string, content: string, languageId: string): void {
    if (!this.connection) return;
    const uri = toFileUri(filePath);
    this.diagnostics.delete(uri);
    this.connection.sendNotification('textDocument/didOpen', {
      textDocument: { uri, languageId, version: 0, text: content },
    });
  }

  /**
   * Notify the server that a document has changed.
   */
  notifyChange(filePath: string, content: string, version: number): void {
    if (!this.connection) return;
    this.connection.sendNotification('textDocument/didChange', {
      textDocument: { uri: toFileUri(filePath), version },
      contentChanges: [{ text: content }],
    });
  }

  /**
   * Wait for diagnostics to arrive for a file.
   *
   * When `waitForChange` is false (default), returns as soon as diagnostics
   * are available. To avoid returning a premature empty array (servers may
   * publish `[]` first while still analysing), empty results trigger a short
   * settle window: polling continues for up to `settleMs` (default 500ms)
   * to see if non-empty diagnostics arrive. Non-empty results are returned
   * immediately.
   */
  async waitForDiagnostics(
    filePath: string,
    timeoutMs: number = 5000,
    waitForChange: boolean = false,
    settleMs: number = 500,
  ): Promise<any[]> {
    if (!this.connection) return [];
    const uri = toFileUri(filePath);
    const startTime = Date.now();
    const initialDiagnostics = this.diagnostics.get(uri);
    let emptyReceivedAt: number | undefined;

    while (Date.now() - startTime < timeoutMs) {
      const currentDiagnostics = this.diagnostics.get(uri);

      if (waitForChange) {
        // Compare by reference — the notification handler sets a new array each time
        if (currentDiagnostics !== undefined && currentDiagnostics !== initialDiagnostics) {
          return currentDiagnostics;
        }
      } else {
        if (currentDiagnostics !== undefined) {
          // Non-empty — the server has real results, return immediately
          if (currentDiagnostics.length > 0) return currentDiagnostics;
          // Empty — start a settle window. The server may have published a
          // clearing notification before the real analysis results arrive.
          if (emptyReceivedAt === undefined) emptyReceivedAt = Date.now();
          if (Date.now() - emptyReceivedAt >= settleMs) return currentDiagnostics;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return waitForChange ? initialDiagnostics || [] : this.diagnostics.get(uri) || [];
  }

  /**
   * Notify the server that a document was closed.
   */
  notifyClose(filePath: string): void {
    if (!this.connection) return;
    const uri = toFileUri(filePath);
    this.diagnostics.delete(uri);
    this.connection.sendNotification('textDocument/didClose', {
      textDocument: { uri },
    });
  }

  /**
   * Shutdown the connection and kill the process.
   */
  async shutdown(): Promise<void> {
    if (this.connection) {
      try {
        if (this.handle && this.handle.exitCode === undefined) {
          let shutdownTimer: ReturnType<typeof setTimeout>;
          await Promise.race([
            this.connection.sendRequest('shutdown'),
            new Promise((_, reject) => {
              shutdownTimer = setTimeout(() => reject(new Error('Shutdown request timed out')), 1000);
            }),
          ]).finally(() => clearTimeout(shutdownTimer!));
          this.connection.sendNotification('exit');
        }
      } catch {
        // Ignore shutdown errors
      }
      try {
        this.connection.dispose();
      } catch {
        // Ignore dispose errors
      }
      this.connection = null;
    }

    if (this.handle) {
      try {
        await this.handle.kill();
      } catch {
        // Ignore kill errors
      }
      this.handle = null;
    }

    this.diagnostics = new Map();
  }
}
