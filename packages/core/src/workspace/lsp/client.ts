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
import { pathToFileURL, fileURLToPath } from 'node:url';

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

/**
 * Normalize a file:// URI to a canonical fs-path-based key for diagnostics
 * map storage/lookup. On Windows, different LSP servers emit different
 * canonical forms for the same path (e.g. `file:///C:/...` vs
 * `file:///c%3A/...`), so we convert back to an OS path and compare those
 * instead of comparing URI strings directly.
 */
export function diagnosticsKey(uriOrPath: string): string {
  let fsPath: string;
  try {
    fsPath = uriOrPath.startsWith('file:') ? fileURLToPath(uriOrPath) : uriOrPath;
  } catch {
    return uriOrPath;
  }
  // Normalize Windows drive-letter paths so they compare equal regardless of
  // drive-letter casing or whether fileURLToPath produced a leading slash
  // (e.g. '/C:/Users/...' vs 'C:/Users/...' vs 'c:\\Users\\...'), independent
  // of the OS this code happens to run on.
  const driveMatch = fsPath.match(/^[\\/]?([a-zA-Z]):([\\/].*)$/);
  if (driveMatch) {
    return `${driveMatch[1]!.toLowerCase()}:${driveMatch[2]}`;
  }
  return fsPath;
}

// =============================================================================
// Timeout Helper
// =============================================================================

async function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(errorMessage)), ms);
    }),
  ]).finally(() => clearTimeout(timer!));
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
  private supportsPullDiagnostics: boolean = false;

  constructor(serverDef: LSPServerDef, workspaceRoot: string, processManager: SandboxProcessManager) {
    this.serverDef = serverDef;
    this.workspaceRoot = workspaceRoot;
    this.processManager = processManager;
  }

  /** Whether the underlying server process is still running. */
  get isAlive(): boolean {
    return this.handle !== null && this.handle.exitCode === undefined;
  }

  /** Name of the LSP server. */
  get serverName(): string {
    return this.serverDef.name;
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
    // vscode-jsonrpc's Connection.sendRequest re-throws stream write errors inside
    // an `async` promise executor. That throw rejects the executor's own implicit
    // promise (which nothing awaits) instead of the request promise, so when the
    // server process dies mid-write (e.g. EPIPE), it surfaces as an unhandled
    // rejection and crashes the host process. Swallow write rejections here: the
    // error still reaches the connection's error handler via the writer's
    // handleError, and every request we send is wrapped in a timeout, so callers
    // get a clean timeout error instead of a fatal crash.
    const originalWrite = writer.write.bind(writer);
    writer.write = (msg: unknown) => originalWrite(msg).catch(() => {});
    this.connection = createMessageConnection(reader, writer);

    // Silently ignore stream destroyed errors during shutdown
    this.connection.onError(() => {});

    // Listen for published diagnostics
    this.connection.onNotification('textDocument/publishDiagnostics', (params: any) => {
      this.diagnostics.set(diagnosticsKey(params.uri), params.diagnostics);
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

    // Handle client/registerCapability requests (TS 7+ sends these during init)
    this.connection.onRequest('client/registerCapability', () => null);

    let initTimer: ReturnType<typeof setTimeout>;
    const initResult: any = await Promise.race([
      this.connection.sendRequest('initialize', initParams),
      new Promise((_, reject) => {
        initTimer = setTimeout(() => reject(new Error('LSP initialize request timed out')), initTimeout);
      }),
    ]).finally(() => clearTimeout(initTimer!));

    // Detect pull diagnostics support (TS 7+ native LSP uses this instead of push)
    if (initResult?.capabilities?.diagnosticProvider) {
      this.supportsPullDiagnostics = true;
    }

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
    this.diagnostics.delete(diagnosticsKey(uri));
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
   * For servers that support pull diagnostics (e.g. TypeScript 7+ native LSP),
   * sends a `textDocument/diagnostic` request directly instead of waiting for
   * push notifications.
   *
   * For push-based servers (e.g. TypeScript ≤6 via typescript-language-server),
   * returns as soon as diagnostics are available. To avoid returning a premature
   * empty array (servers may publish `[]` first while still analysing), empty
   * results trigger a short settle window: polling continues for up to `settleMs`
   * (default 500ms) to see if non-empty diagnostics arrive. Non-empty results
   * are returned immediately.
   */
  async waitForDiagnostics(
    filePath: string,
    timeoutMs: number = 5000,
    waitForChange: boolean = false,
    settleMs: number = 500,
  ): Promise<any[]> {
    if (!this.connection) return [];

    // Pull diagnostics: request directly from the server
    if (this.supportsPullDiagnostics) {
      try {
        const result: any = await withTimeout(
          this.connection.sendRequest('textDocument/diagnostic', {
            textDocument: { uri: toFileUri(filePath) },
          }),
          timeoutMs,
          'Pull diagnostics request timed out',
        );
        const items = result?.items ?? [];
        // Mirror into the diagnostics map so later lookups see the same
        // data regardless of whether the server pushes or pulls.
        this.diagnostics.set(diagnosticsKey(toFileUri(filePath)), items);
        return items;
      } catch {
        return [];
      }
    }

    // Push diagnostics: poll the diagnostics map populated by publishDiagnostics
    const uri = diagnosticsKey(toFileUri(filePath));
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
    this.diagnostics.delete(diagnosticsKey(uri));
    this.connection.sendNotification('textDocument/didClose', {
      textDocument: { uri },
    });
  }

  /**
   * Query hover information at a position.
   */
  async queryHover(uri: string, position: { line: number; character: number }, timeoutMs: number = 5000): Promise<any> {
    if (!this.connection) return null;
    return withTimeout(
      this.connection.sendRequest('textDocument/hover', { textDocument: { uri }, position }),
      timeoutMs,
      'Hover request timed out',
    );
  }

  /**
   * Query definition(s) at a position.
   */
  async queryDefinition(
    uri: string,
    position: { line: number; character: number },
    timeoutMs: number = 5000,
  ): Promise<any[]> {
    if (!this.connection) return [];
    const result = await withTimeout(
      this.connection.sendRequest('textDocument/definition', { textDocument: { uri }, position }),
      timeoutMs,
      'Definition request timed out',
    );
    if (!result) return [];
    return Array.isArray(result) ? result : (result as any).uri ? [result] : [];
  }

  /**
   * Query type definition(s) at a position.
   */
  async queryTypeDefinition(
    uri: string,
    position: { line: number; character: number },
    timeoutMs: number = 5000,
  ): Promise<any[]> {
    if (!this.connection) return [];
    const result = await withTimeout(
      this.connection.sendRequest('textDocument/typeDefinition', { textDocument: { uri }, position }),
      timeoutMs,
      'Type definition request timed out',
    );
    if (!result) return [];
    return Array.isArray(result) ? result : (result as any).uri ? [result] : [];
  }

  /**
   * Query implementation(s) at a position.
   */
  async queryImplementation(
    uri: string,
    position: { line: number; character: number },
    timeoutMs: number = 5000,
  ): Promise<any[]> {
    if (!this.connection) return [];
    const result = await withTimeout(
      this.connection.sendRequest('textDocument/implementation', { textDocument: { uri }, position }),
      timeoutMs,
      'Implementation request timed out',
    );
    if (!result) return [];
    return Array.isArray(result) ? result : (result as any).uri ? [result] : [];
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
