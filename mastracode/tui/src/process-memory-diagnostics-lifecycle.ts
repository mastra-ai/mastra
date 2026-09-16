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

export function createOneShotFatalErrorHandler(handle: (error: unknown) => void): (error: unknown) => void {
  let handlingFatalError = false;
  return error => {
    if (handlingFatalError) return;
    handlingFatalError = true;
    handle(error);
  };
}

export function createShutdownCoordinator(
  cleanup: () => Promise<void>,
  exit: (exitCode: number) => never,
  timeoutMs = 5_000,
): (exitCode: number) => Promise<void> {
  let shutdownPromise: Promise<void> | null = null;
  return exitCode => {
    shutdownPromise ??= (async () => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        cleanup().catch(() => undefined),
        new Promise<void>(resolve => {
          timeout = setTimeout(resolve, timeoutMs);
        }),
      ]);
      if (timeout) clearTimeout(timeout);
      exit(exitCode);
    })();
    return shutdownPromise;
  };
}
