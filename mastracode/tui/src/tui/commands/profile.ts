import type {
  ProcessMemoryDiagnostics,
  ProcessMemoryDiagnosticsMemorySample,
  ProcessMemoryDiagnosticsStatus,
} from '@mastra/code-sdk/process-memory-diagnostics';

import type { SlashCommandContext } from './types.js';

const USAGE = 'Usage: /profile [status|start|capture|stop]';

function formatBytes(bytes: number): string {
  const mib = bytes / 1024 ** 2;
  return `${mib.toFixed(1)} MiB`;
}

function formatLatestSample(sample: ProcessMemoryDiagnosticsMemorySample | null): string {
  if (!sample) return 'Latest sample: none';
  return [
    `Latest sample: ${sample.timestamp}`,
    `  RSS: ${formatBytes(sample.memory.rss)}`,
    `  JS heap used: ${formatBytes(sample.memory.heapUsed)}`,
    `  External: ${formatBytes(sample.memory.external)}`,
    `  ArrayBuffers: ${formatBytes(sample.memory.arrayBuffers)}`,
  ].join('\n');
}

export function formatProcessMemoryDiagnosticsStatus(status: ProcessMemoryDiagnosticsStatus): string {
  return [
    `Process memory diagnostics: ${status.state}`,
    `Output directory: ${status.outputDirectory ?? 'none'}`,
    `Sample interval: ${status.config.sampleIntervalMs} ms`,
    `Capture interval: ${status.config.captureIntervalMs} ms`,
    `Allocation sampling interval: ${status.config.allocationIntervalBytes} bytes`,
    `Samples: ${status.sampleCount}`,
    `Allocation captures: ${status.captureCount}`,
    `GC events: ${status.gcEventCount}`,
    formatLatestSample(status.latestSample),
    ...(status.error ? [`Error: ${status.error}`] : []),
  ].join('\n');
}

function getDiagnostics(ctx: SlashCommandContext): ProcessMemoryDiagnostics | null {
  if (ctx.processMemoryDiagnostics) return ctx.processMemoryDiagnostics;
  ctx.showError('Process memory diagnostics are not available in this session.');
  return null;
}

export async function handleProfileCommand(ctx: SlashCommandContext, args: string[] = []): Promise<void> {
  if (args.length > 1) {
    ctx.showError(USAGE);
    return;
  }

  const subcommand = (args[0] ?? 'status').toLowerCase();
  if (!['status', 'start', 'capture', 'stop'].includes(subcommand)) {
    ctx.showError(USAGE);
    return;
  }

  const diagnostics = getDiagnostics(ctx);
  if (!diagnostics) return;

  if (subcommand === 'status') {
    ctx.showInfo(formatProcessMemoryDiagnosticsStatus(diagnostics.getStatus()));
    return;
  }

  if (subcommand === 'start') {
    const current = diagnostics.getStatus();
    if (current.state === 'active') {
      ctx.showInfo(`Process memory diagnostics are already active.\n${formatProcessMemoryDiagnosticsStatus(current)}`);
      return;
    }

    const status = await diagnostics.start();
    if (status.state !== 'active') {
      ctx.showError(`Unable to start process memory diagnostics: ${status.error ?? status.state}`);
      return;
    }

    ctx.showInfo(
      [
        'Process memory diagnostics started.',
        `Artifacts: ${status.outputDirectory}`,
        'Profiling adds allocation-sampling and periodic file-write overhead.',
        'Keep artifacts private: allocation profiles may contain prompts, credentials, file contents, and tool arguments.',
      ].join('\n'),
    );
    return;
  }

  if (subcommand === 'capture') {
    if (diagnostics.getStatus().state !== 'active') {
      ctx.showError('Process memory diagnostics are not active. Use /profile start first.');
      return;
    }

    try {
      const capture = await diagnostics.capture('manual');
      ctx.showInfo(
        [
          'Allocation profile captured.',
          `Artifact: ${capture.path}`,
          'Capture overhead briefly rotates the sampling epoch; it does not force GC or write a heap snapshot.',
          'Keep the artifact private because allocation profiles may contain sensitive application data.',
        ].join('\n'),
      );
    } catch (error) {
      ctx.showError(`Unable to capture allocation profile: ${error instanceof Error ? error.message : String(error)}`);
    }
    return;
  }

  const current = diagnostics.getStatus();
  if (current.state === 'inactive') {
    ctx.showInfo(`Process memory diagnostics are already inactive.\n${formatProcessMemoryDiagnosticsStatus(current)}`);
    return;
  }

  const status = await diagnostics.stop();
  if (status.state === 'error') {
    ctx.showError(
      `Process memory diagnostics stopped with an error: ${status.error ?? 'unknown error'}\nArtifacts: ${status.outputDirectory ?? 'none'}`,
    );
    return;
  }
  ctx.showInfo(`Process memory diagnostics stopped.\nArtifacts: ${status.outputDirectory ?? 'none'}`);
}
