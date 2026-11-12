import { constants, monitorEventLoopDelay, PerformanceObserver } from 'node:perf_hooks';
import type { PerformanceEntry } from 'node:perf_hooks';
import { getHeapStatistics } from 'node:v8';

import type { MetricsCollector } from '../metrics.js';

const LOOP_RESOLUTION_MS = 20;

const GC_KINDS: Record<number, string> = {
  [constants.NODE_PERFORMANCE_GC_MINOR]: 'minor',
  [constants.NODE_PERFORMANCE_GC_MAJOR]: 'major',
  [constants.NODE_PERFORMANCE_GC_INCREMENTAL]: 'incremental',
  [constants.NODE_PERFORMANCE_GC_WEAKCB]: 'weakcb',
};

/**
 * Event-loop delay, memory against the heap limit, CPU and uptime of this Node process. Each GC
 * pause is passed to `onGcPause` as it happens, to be aggregated per interval.
 */
export function processCollector(onGcPause?: (kind: string, ms: number) => void): MetricsCollector {
  const loop = monitorEventLoopDelay({ resolution: LOOP_RESOLUTION_MS });
  loop.enable();
  let gc: PerformanceObserver | undefined;
  if (onGcPause) {
    gc = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const kind = GC_KINDS[(entry as PerformanceEntry & { detail?: { kind?: number } }).detail?.kind ?? -1];
        onGcPause(kind ?? 'other', entry.duration);
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
      sink.emit('mastra_factory_event_loop_delay_ms', delayMs(loop.percentile(50)), { stat: 'p50' });
      sink.emit('mastra_factory_event_loop_delay_ms', delayMs(loop.percentile(99)), { stat: 'p99' });
      sink.emit('mastra_factory_event_loop_delay_ms', delayMs(loop.max), { stat: 'max' });
      loop.reset();

      const memory = process.memoryUsage();
      sink.emit('mastra_factory_process_memory_bytes', memory.rss, { kind: 'rss' });
      sink.emit('mastra_factory_process_memory_bytes', memory.heapUsed, { kind: 'heap_used' });
      sink.emit('mastra_factory_process_memory_bytes', getHeapStatistics().heap_size_limit, { kind: 'heap_limit' });

      // Share of one core used since the last sample (1 = one core fully busy).
      const cpu = process.cpuUsage(lastCpu);
      const now = performance.now();
      sink.emit('mastra_factory_process_cpu_ratio', (cpu.user + cpu.system) / 1000 / (now - lastAt));
      lastCpu = process.cpuUsage();
      lastAt = now;

      sink.emit('mastra_factory_process_uptime_s', process.uptime());
    },
    stop() {
      loop.disable();
      gc?.disconnect();
    },
  };
}
