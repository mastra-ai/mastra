import type { ChildProcess } from 'node:child_process';
import { StreamMessageReader, StreamMessageWriter, createMessageConnection } from 'vscode-jsonrpc/node.js';
import type { MessageConnection } from 'vscode-jsonrpc/node.js';
import { TextDocumentIdentifier, Position } from 'vscode-languageserver-protocol';
import type { Diagnostic } from 'vscode-languageserver-protocol';
import type { LSPServerInfo } from './server';

/**
 * LSP Client wrapper for JSON-RPC communication
 */
export class LSPClient {
  private connection: MessageConnection | null = null;
  private process: ChildProcess | null = null;
  private serverInfo: LSPServerInfo;
  private workspaceRoot: string;
  private diagnostics: Map<string, Diagnostic[]> = new Map();
  private initializationOptions: any = null;

  constructor(serverInfo: LSPServerInfo, workspaceRoot: string) {
    this.serverInfo = serverInfo;
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Initialize the LSP connection
   */
  async initialize(): Promise<void> {
    const spawnResult = await this.serverInfo.spawn(this.workspaceRoot);

    if (!spawnResult) {
      throw new Error('Failed to spawn LSP server');
    }

    // Handle both ChildProcess and { process: ChildProcess, initialization? } formats
    let initializationOptions: any = undefined;
    if ('process' in spawnResult) {
      this.process = spawnResult.process;
      initializationOptions = spawnResult.initialization;
    } else {
      this.process = spawnResult;
    }

    if (!this.process.stdin || !this.process.stdout) {
      throw new Error('Failed to create LSP process with proper stdio');
    }

    const reader = new StreamMessageReader(this.process.stdout);
    const writer = new StreamMessageWriter(this.process.stdin);
    this.connection = createMessageConnection(reader, writer);

    // Handle connection errors (e.g., ERR_STREAM_DESTROYED during shutdown)
    this.connection.onError(error => {
      // Silently ignore stream destroyed errors during shutdown
      const errorObj = error?.[0] as any;
      if (errorObj?.code !== 'ERR_STREAM_DESTROYED') {
      }
    });

    // Set up diagnostic listener before starting connection

    this.connection.onNotification('textDocument/publishDiagnostics', (params: any) => {
      if (params.diagnostics && params.diagnostics.length > 0) {
      }
      this.diagnostics.set(params.uri, params.diagnostics);
    });
    (this.connection as any).onNotification((_method: string, _params: any) => {});

    this.connection.listen();

    // Capture stderr for debugging
    if (this.process.stderr) {
      this.process.stderr.on('data', _data => {});
    }

    // Handle process errors
    this.process.on('error', _error => {});

    this.process.on('exit', (_code, _signal) => {});

    // Send initialize request matching OpenCode's structure
    const initParams: any = {
      processId: process.pid,
      rootUri: `file://${this.workspaceRoot}`,
      workspaceFolders: [
        {
          name: 'workspace',
          uri: `file://${this.workspaceRoot}`,
        },
      ],
      capabilities: {
        window: {
          workDoneProgress: true,
        },
        workspace: {
          configuration: true,
        },
        textDocument: {
          publishDiagnostics: {
            relatedInformation: true,
            tagSupport: {
              valueSet: [1, 2],
            },
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
          definition: {
            dynamicRegistration: false,
            linkSupport: true,
          },
          typeDefinition: {
            dynamicRegistration: false,
            linkSupport: true,
          },
          implementation: {
            dynamicRegistration: false,
            linkSupport: true,
          },
          references: {
            dynamicRegistration: false,
          },
          documentHighlight: {
            dynamicRegistration: false,
          },
          documentSymbol: {
            dynamicRegistration: false,
            hierarchicalDocumentSymbolSupport: true,
          },
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
          hover: {
            dynamicRegistration: false,
            contentFormat: ['markdown', 'plaintext'],
          },
        },
      },
    };

    // Add initialization options if provided by the server
    if (initializationOptions) {
      initParams.initializationOptions = initializationOptions;
      this.initializationOptions = initializationOptions;
    }

    // Add workspace/configuration request handler like OpenCode
    this.connection.onRequest('workspace/configuration', (params: any) => {
      return params.items?.map(() => ({})) || [];
    });

    // Handle window/workDoneProgress/create requests
    this.connection.onRequest('window/workDoneProgress/create', (_params: any) => {
      return null;
    });

    await Promise.race([
      this.connection.sendRequest('initialize', initParams),
      new Promise((_, reject) => setTimeout(() => reject(new Error('LSP initialize request timed out')), 10000)),
    ]);

    // Send initialized notification with empty object like OpenCode
    this.connection.sendNotification('initialized', {});

    // Send workspace/didChangeConfiguration with initialization options like OpenCode
    if (this.initializationOptions) {
      this.connection.sendNotification('workspace/didChangeConfiguration', {
        settings: this.initializationOptions,
      });
    } else {
      this.connection.sendNotification('workspace/didChangeConfiguration', {
        settings: {},
      });
    }
  }

  /**
   * Notify the server that a document has been opened
   */
  notifyOpen(filePath: string, content: string, languageId: string): void {
    if (!this.connection) return;

    const uri = `file://${filePath}`;

    // Clear diagnostics for this file before sending didOpen (like OpenCode does)
    this.diagnostics.delete(uri);

    this.connection.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId,
        version: 0,
        text: content,
      },
    });
  }

  /**
   * Notify the server that a document has changed
   */
  notifyChange(filePath: string, content: string, version: number): void {
    if (!this.connection) return;

    this.connection.sendNotification('textDocument/didChange', {
      textDocument: {
        uri: `file://${filePath}`,
        version,
      },
      contentChanges: [{ text: content }],
    });
  }

  /**
   * Wait for diagnostics to be available for a specific file
   * @param waitForChange If true, waits for diagnostics to change from their initial state
   */
  async waitForDiagnostics(
    filePath: string,
    timeoutMs: number = 5000,
    waitForChange: boolean = false,
  ): Promise<Diagnostic[]> {
    if (!this.connection) return [];

    const uri = `file://${filePath}`;
    const startTime = Date.now();
    const initialDiagnostics = this.diagnostics.get(uri);
    const initialCount = initialDiagnostics?.length || 0;

    // Poll for diagnostics to be updated
    while (Date.now() - startTime < timeoutMs) {
      const currentDiagnostics = this.diagnostics.get(uri);
      const currentCount = currentDiagnostics?.length || 0;

      // If waiting for change, check if diagnostics have changed
      if (waitForChange) {
        if (currentDiagnostics !== undefined && currentCount !== initialCount) {
          return currentDiagnostics;
        }
      } else {
        // Return if we have diagnostics (even if empty array)
        if (currentDiagnostics !== undefined) {
          return currentDiagnostics;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return waitForChange ? initialDiagnostics || [] : [];
  }

  /**
   * Get hover information for a position
   */
  async getHover(filePath: string, line: number, character: number): Promise<any> {
    if (!this.connection) return null;

    try {
      return await this.connection.sendRequest('textDocument/hover', {
        textDocument: TextDocumentIdentifier.create(`file://${filePath}`),
        position: Position.create(line, character),
      });
    } catch {
      return null;
    }
  }

  /**
   * Get diagnostics for a specific file
   */
  getDiagnostics(filePath: string): Diagnostic[] {
    const uri = `file://${filePath}`;
    return this.diagnostics.get(uri) || [];
  }

  /**
   * Get all diagnostics from all files
   */
  getAllDiagnostics(): Diagnostic[] {
    const allDiagnostics: Diagnostic[] = [];
    for (const diagnostics of this.diagnostics.values()) {
      allDiagnostics.push(...diagnostics);
    }
    return allDiagnostics;
  }

  /**
   * Notify server that a file was closed
   */
  notifyClose(filePath: string): void {
    if (!this.connection) return;

    const uri = `file://${filePath}`;

    // Clear diagnostics for this file
    this.diagnostics.delete(uri);

    // Send didClose notification
    this.connection.sendNotification('textDocument/didClose', {
      textDocument: TextDocumentIdentifier.create(uri),
    });
  }

  /**
   * Restart the LSP client
   */
  async restart(): Promise<void> {
    await this.shutdown();

    // Re-initialize (this will re-spawn the server)
    await this.initialize();
  }

  /**
   * Shutdown the connection
   */
  async shutdown(): Promise<void> {
    if (this.connection) {
      try {
        // Only send shutdown request if the process is still alive
        const processAlive = this.process && !this.process.killed;
        if (processAlive) {
          await Promise.race([
            this.connection.sendRequest('shutdown'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Shutdown request timed out')), 1000)),
          ]);
          this.connection.sendNotification('exit');
        }
      } catch {
        // Ignore shutdown errors (process may have already crashed)
      }
      try {
        this.connection.dispose();
      } catch {
        // Ignore dispose errors (stream may already be destroyed)
      }
      this.connection = null;
    }

    if (this.process) {
      try {
        if (!this.process.killed) {
          this.process.kill();
        }
      } catch {
        // Ignore kill errors
      }
      this.process = null;
    }

    this.diagnostics = new Map();
  }
}
