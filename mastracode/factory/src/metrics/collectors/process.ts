import { monitorEventLoopDelay } from 'node:perf_hooks';

import type { MetricsCollector } from '../metrics.js';

const LOOP_RESOLUTION_MS = 20;

/** Event-loop delay, memory, CPU and uptime of this Node process. */
export function processCollector(): MetricsCollector {
  const loop = monitorEventLoopDelay({ resolution: LOOP_RESOLUTION_MS });
  loop.enable();
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

      // Share of one core used since the last sample (1 = one core fully busy).
      const cpu = process.cpuUsage(lastCpu);
      const now = performance.now();
      sink.emit('mastra_factory_process_cpu_ratio', (cpu.user + cpu.system) / 1000 / (now - lastAt));
      lastCpu = process.cpuUsage();
      lastAt = now;

      sink.emit('mastra_factory_process_uptime_s', process.uptime());
    },
  };
}
