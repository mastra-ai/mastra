/**
 * Native Sandbox Types
 *
 * Configuration types for OS-native sandboxing backends.
 */

/**
 * Available isolation backends.
 * - 'none': No sandboxing (direct execution on host)
 * - 'seatbelt': macOS sandbox-exec (built-in)
 * - 'bwrap': Linux bubblewrap (requires installation)
 */
export type IsolationBackend = 'none' | 'seatbelt' | 'bwrap';

/**
 * Configuration for native sandboxing.
 * These options control filesystem and network access within the sandbox.
 */
export interface NativeSandboxConfig {
  /**
   * Allow network access from within the sandbox.
   * @default false
   */
  allowNetwork?: boolean;

  /**
   * Additional paths to allow read-only access to.
   * These paths will be mounted/allowed in addition to system defaults.
   */
  readOnlyPaths?: string[];

  /**
   * Additional paths to allow read-write access to.
   * By default, only the workspace directory has write access.
   */
  readWritePaths?: string[];

  /**
   * Allow executing system binaries (node, python, etc.)
   * When false, only binaries within the workspace can be executed.
   * @default true
   */
  allowSystemBinaries?: boolean;

  /**
   * Path to a custom seatbelt profile file (macOS only).
   * If the file exists, its contents are used as the sandbox profile.
   * If the file doesn't exist, a default profile is generated and written to this path.
   * Must contain valid SBPL (Sandbox Profile Language) if provided.
   */
  seatbeltProfilePath?: string;

  /**
   * Custom bwrap arguments (Linux only).
   * When provided, these completely replace the default bwrap arguments.
   * The command and its args are appended after these.
   */
  bwrapArgs?: string[];
}

/**
 * Result of sandbox backend detection.
 */
export interface SandboxDetectionResult {
  /** The detected/recommended backend */
  backend: IsolationBackend;
  /** Whether the backend is available and functional */
  available: boolean;
  /** Human-readable message about the detection result */
  message: string;
}
