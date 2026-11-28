import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { constants, monitorEventLoopDelay, PerformanceObserver } from 'node:perf_hooks';
import type { PerformanceEntry } from 'node:perf_hooks';
import { getHeapSpaceStatistics, getHeapStatistics } from 'node:v8';

import type { MetricsCollector } from '../metrics.js';

const LOOP_RESOLUTION_MS = 20;

// V8 heap spaces worth charting: together they explain most of heapTotal. Fixed list so the
// `space` label can't grow with runtime data, and names are normalized to drop the v8 `_space`
// suffix (`old`, `new`, `code`, `large_object`, `trusted`, `shared`). Unknown spaces are
// summed into `other` so the metric always totals to heapTotal.
const HEAP_SPACES: Record<string, string> = {
  old_space: 'old',
  new_space: 'new',
  code_space: 'code',
  large_object_space: 'large_object',
  code_large_object_space: 'code_large_object',
  new_large_object_space: 'new_large_object',
  trusted_space: 'trusted',
  trusted_large_object_space: 'trusted_large_object',
  shared_space: 'shared',
  shared_large_object_space: 'shared_large_object',
};

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
      // Same shape as the other timings: `stat=avg|p95|max` plus a `_count` series (delay samples taken).
      sink.emit('mastra_factory_event_loop_delay_ms_count', loop.count);
      sink.emit('mastra_factory_event_loop_delay_ms', delayMs(loop.mean), { stat: 'avg' });
      sink.emit('mastra_factory_event_loop_delay_ms', delayMs(loop.percentile(95)), { stat: 'p95' });
      sink.emit('mastra_factory_event_loop_delay_ms', delayMs(loop.max), { stat: 'max' });
      loop.reset();

      // Share of the interval the main thread spent running JavaScript and callbacks, 0 to 1.
      const utilization = performance.eventLoopUtilization(lastUtilization);
      lastUtilization = performance.eventLoopUtilization();
      sink.emit('mastra_factory_event_loop_utilization', utilization.utilization);

      // RSS minus heap_total minus external is a rough "native overhead" (allocator fragmentation,
      // thread stacks, native modules); watching heap_total alongside heap_used shows how much the
      // v8 heap is committed but unused after peaks, which is the first hypothesis for RSS that
      // doesn't fall after a burst.
      const memory = process.memoryUsage();
      sink.emit('mastra_factory_process_memory_bytes', memory.rss, { kind: 'rss' });
      sink.emit('mastra_factory_process_memory_bytes', memory.heapTotal, { kind: 'heap_total' });
      sink.emit('mastra_factory_process_memory_bytes', memory.heapUsed, { kind: 'heap_used' });
      sink.emit('mastra_factory_process_memory_bytes', memory.external, { kind: 'external' });
      sink.emit('mastra_factory_process_memory_bytes', memory.arrayBuffers, { kind: 'array_buffers' });
      const heapLimit = getHeapStatistics().heap_size_limit;
      sink.emit('mastra_factory_process_memory_bytes', heapLimit, { kind: 'heap_limit' });
      sink.emit('mastra_factory_process_heap_utilization', memory.heapUsed / heapLimit);

      // Per-space heap sizes: cheap (~microseconds) and the only way to tell e.g. large-object
      // retention from code-cache growth. Unknown spaces are folded into `other` so the sum of
      // `space` values equals heap_total.
      let other = 0;
      for (const space of getHeapSpaceStatistics()) {
        const label = HEAP_SPACES[space.space_name];
        if (label) sink.emit('mastra_factory_process_heap_space_bytes', space.space_size, { space: label });
        else other += space.space_size;
      }
      sink.emit('mastra_factory_process_heap_space_bytes', other, { space: 'other' });

      // CPU used by every thread of the process (main thread, GC helpers, the libuv pool, workers)
      // since the last sample, in cores: 1.4 means 1.4 cores' worth, like 140% in top. It can go
      // above 1; compare it to the limit, not to 1. The main thread's load is event-loop utilization.
      const cpu = process.cpuUsage(lastCpu);
      const now = performance.now();
      sink.emit('mastra_factory_process_cpu_cores', (cpu.user + cpu.system) / 1000 / (now - lastAt));
      lastCpu = process.cpuUsage();
      lastAt = now;
      sink.emit('mastra_factory_process_cpu_limit_cores', cpuLimit);

      sink.emit('mastra_factory_process_uptime_ms', process.uptime() * 1000);
    },
    stop() {
      loop.disable();
      gc?.disconnect();
    },
  };
}
