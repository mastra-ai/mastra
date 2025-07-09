/**
 * Mastra Telemetry V-Next
 *
 * New telemetry interface that addresses limitations of the current system
 * while incorporating best practices from leading AI observability platforms.
 */

// Core types and interfaces
export * from './default';
export * from './types';
export * from './registry';

// Abstract base class
export { MastraTelemetry, telemetryDefaultOptions } from './base';

// Decorators
export { withSpan, InstrumentClass } from './decorators';
