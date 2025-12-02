/**
 * Tracing Context Integration
 *
 * This module provides automatic tracing context propagation throughout Mastra's execution contexts.
 * It uses JavaScript Proxies to transparently wrap Mastra, Agent, and Workflow instances so that
 * tracing context is automatically injected without requiring manual passing by users.
 */
import type { MastraPrimitives } from '../action/index.js';
import type { Mastra } from '../mastra/index.js';
import type { TracingContext } from './types/index.js';
/**
 * Checks to see if a passed object is an actual instance of Mastra
 * (for the purposes of wrapping it for Tracing)
 */
export declare function isMastra<T extends Mastra | (Mastra & MastraPrimitives) | MastraPrimitives>(mastra: T): boolean;
/**
 * Creates a tracing-aware Mastra proxy that automatically injects
 * tracing context into agent and workflow method calls
 */
export declare function wrapMastra<T extends Mastra | (Mastra & MastraPrimitives) | MastraPrimitives>(mastra: T, tracingContext: TracingContext): T;
//# sourceMappingURL=context.d.ts.map