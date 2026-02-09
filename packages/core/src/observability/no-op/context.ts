import type { Counter, Gauge, Histogram, LoggerContext, MetricsContext } from '../types';

const noOpCounter: Counter = { add() {} };
const noOpGauge: Gauge = { set() {} };
const noOpHistogram: Histogram = { record() {} };

export const noOpLoggerContext: LoggerContext = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export const noOpMetricsContext: MetricsContext = {
  counter() {
    return noOpCounter;
  },
  gauge() {
    return noOpGauge;
  },
  histogram() {
    return noOpHistogram;
  },
};
