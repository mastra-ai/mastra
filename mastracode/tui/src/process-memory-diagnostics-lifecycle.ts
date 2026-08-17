import {
  createProcessMemoryDiagnosticsFromEnvironment,
  startConfiguredProcessMemoryDiagnostics,
  type ProcessMemoryDiagnostics,
  type ProcessMemoryDiagnosticsEnvironment,
  type ProcessMemoryDiagnosticsSetup,
} from '@mastra/code-sdk/process-memory-diagnostics';

export async function startTuiProcessMemoryDiagnostics(
  env: ProcessMemoryDiagnosticsEnvironment,
  warn: (message: string) => void,
  createSetup: (
    env: ProcessMemoryDiagnosticsEnvironment,
  ) => ProcessMemoryDiagnosticsSetup = createProcessMemoryDiagnosticsFromEnvironment,
): Promise<ProcessMemoryDiagnostics> {
  return startConfiguredProcessMemoryDiagnostics(createSetup(env), warn);
}

export function createShutdownCoordinator(
  cleanup: () => Promise<void>,
  exit: (exitCode: number) => never,
): (exitCode: number) => Promise<void> {
  let shutdownPromise: Promise<void> | null = null;
  return exitCode => {
    shutdownPromise ??= cleanup().then(() => exit(exitCode));
    return shutdownPromise;
  };
}
