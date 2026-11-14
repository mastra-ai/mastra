import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { constants, monitorEventLoopDelay, PerformanceObserver } from 'node:perf_hooks';
import type { PerformanceEntry } from 'node:perf_hooks';
import { getHeapStatistics } from 'node:v8';

import type { MetricsCollector } from '../metrics.js';

const LOOP_RESOLUTION_MS = 20;

function readNumbers(path: string): string[] | undefined {
  try {
    return readFileSync(path, 'utf8').trim().split(/\s+/);
  } catch {
    return undefined;
  }
}

/**
 * Cores this process can use: the container's CPU limit when one is set (cgroup v2 `cpu.max`, or
 * v1 `cpu.cfs_quota_us` / `cpu.cfs_period_us`), otherwise the cores the machine reports.
 */
export function cpuLimitCores(): number {
  const parallelism = availableParallelism();
  const v2 = readNumbers('/sys/fs/cgroup/cpu.max');
  const quota = v2 ? Number(v2[0]) : Number(readNumbers('/sys/fs/cgroup/cpu/cpu.cfs_quota_us')?.[0]);
  const period = v2 ? Number(v2[1]) : Number(readNumbers('/sys/fs/cgroup/cpu/cpu.cfs_period_us')?.[0]);
  if (!(quota > 0 && period > 0)) return parallelism;
  return Math.min(quota / period, parallelism);
}

// Only the pauses worth a series: minor pauses already show in event-loop delay, and weak-callback
// passes are noise.
const GC_KINDS: Record<number, string> = {
  [constants.NODE_PERFORMANCE_GC_MAJOR]: 'major',
  [constants.NODE_PERFORMANCE_GC_INCREMENTAL]: 'incremental',
};

/**
 * Event-loop delay and utilization, memory against the heap limit, CPU against the CPU limit, and
 * uptime of this Node process. Each major or incremental GC pause is passed to `onGcPause` as it
 * happens, to be aggregated per interval.
 */
export function processCollector(onGcPause?: (kind: string, ms: number) => void): MetricsCollector {
  const cpuLimit = cpuLimitCores();
  let lastUtilization = performance.eventLoopUtilization();
  const loop = monitorEventLoopDelay({ resolution: LOOP_RESOLUTION_MS });
  loop.enable();
  let gc: PerformanceObserver | undefined;
  if (onGcPause) {
    gc = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const kind = GC_KINDS[(entry as PerformanceEntry & { detail?: { kind?: number } }).detail?.kind ?? -1];
        if (kind) onGcPause(kind, entry.duration);
      }
    });
    gc.observe({ entryTypes: ['gc'] });
  }
  let lastCpu = process.cpuUsage();
  let lastAt = performance.now();
  return {
    collect(sink) {
      // The histogram records each sampling timer's full wait, so an idle loop reads as the
      // resolution; subtract it to get the delay.
      const delayMs = (ns: number) => Math.max(0, ns / 1e6 - LOOP_RESOLUTION_MS);
      // Same stat set as the other timings. `count` is the number of delay samples taken.
      sink.emit('mastra_factory_event_loop_delay_ms', loop.count, { stat: 'count' });
      sink.emit('mastra_factory_event_loop_delay_ms', delayMs(loop.mean), { stat: 'avg' });
      sink.emit('mastra_factory_event_loop_delay_ms', delayMs(loop.percentile(95)), { stat: 'p95' });
      sink.emit('mastra_factory_event_loop_delay_ms', delayMs(loop.max), { stat: 'max' });
      loop.reset();

      // Share of the interval the main thread spent running JavaScript and callbacks, 0 to 1.
      const utilization = performance.eventLoopUtilization(lastUtilization);
      lastUtilization = performance.eventLoopUtilization();
      sink.emit('mastra_factory_event_loop_utilization', utilization.utilization);

      const memory = process.memoryUsage();
      sink.emit('mastra_factory_process_memory_bytes', memory.rss, { kind: 'rss' });
      sink.emit('mastra_factory_process_memory_bytes', memory.heapUsed, { kind: 'heap_used' });
      const heapLimit = getHeapStatistics().heap_size_limit;
      sink.emit('mastra_factory_process_memory_bytes', heapLimit, { kind: 'heap_limit' });
      sink.emit('mastra_factory_process_heap_utilization', memory.heapUsed / heapLimit);

      // CPU used by every thread of the process (main thread, GC helpers, the libuv pool, workers)
      // since the last sample, in cores: 1.4 means 1.4 cores' worth, like 140% in top. It can go
      // above 1; compare it to the limit, not to 1. The main thread's load is event-loop utilization.
      const cpu = process.cpuUsage(lastCpu);
      const now = performance.now();
      sink.emit('mastra_factory_process_cpu_ratio', (cpu.user + cpu.system) / 1000 / (now - lastAt));
      lastCpu = process.cpuUsage();
      lastAt = now;
      sink.emit('mastra_factory_process_cpu_limit_cores', cpuLimit);

      sink.emit('mastra_factory_process_uptime_s', process.uptime());
    },
    stop() {
      loop.disable();
      gc?.disconnect();
    },
  };
}
