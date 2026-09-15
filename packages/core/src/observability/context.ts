/**
 * Tracing Context Integration
 *
 * This module provides automatic tracing context propagation throughout Mastra's execution contexts.
 * It uses JavaScript Proxies to transparently wrap Mastra, Agent, and Workflow instances so that
 * tracing context is automatically injected without requiring manual passing by users.
 */

import type { MastraPrimitives } from '../action';
import type { Agent } from '../agent';
import type { Mastra } from '../mastra';
import type { Workflow } from '../workflows';
import { createObservabilityContext } from './context-factory';
import type { TracingContext, AnySpan } from './types';

const AGENT_GETTERS = ['getAgent', 'getAgentById'];
const AGENT_METHODS_TO_WRAP = ['generate', 'stream', 'generateLegacy', 'streamLegacy'];

const WORKFLOW_GETTERS = ['getWorkflow', 'getWorkflowById'];
const WORKFLOW_METHODS_TO_WRAP = ['execute', 'createRun', 'createRun'];

/**
 * Maps a tracing proxy back to the instance it wraps. `wrapMastra` returns a
 * Proxy that forwards property reads but is a distinct object identity from its
 * target, so identity-sensitive lookups keyed on the Mastra instance would treat
 * the proxy as a different Mastra. Cycles are impossible: a proxy's recorded
 * target always existed before the proxy was created.
 */
const tracingProxyTargets = new WeakMap<object, object>();

/**
 * Helper function to detect NoOp spans to avoid unnecessary wrapping
 */
function isNoOpSpan(span: AnySpan): boolean {
  // Check if this is a NoOp span implementation
  return span.constructor.name === 'NoOpSpan' || (span as any).__isNoOp === true;
}

/**
 * Checks to see if a passed object is an actual instance of Mastra
 * (for the purposes of wrapping it for Tracing)
 */
export function isMastra<T extends Mastra | (Mastra & MastraPrimitives) | MastraPrimitives>(mastra: T): boolean {
  const hasAgentGetters = AGENT_GETTERS.every(method => typeof (mastra as any)?.[method] === 'function');
  const hasWorkflowGetters = WORKFLOW_GETTERS.every(method => typeof (mastra as any)?.[method] === 'function');

  return hasAgentGetters && hasWorkflowGetters;
}

/**
 * Creates a tracing-aware Mastra proxy that automatically injects
 * tracing context into agent and workflow method calls
 */
export function wrapMastra<T extends Mastra | (Mastra & MastraPrimitives) | MastraPrimitives>(
  mastra: T,
  tracingContext: TracingContext,
): T {
  // Don't wrap if no current span or if using NoOp span
  if (!tracingContext.currentSpan || isNoOpSpan(tracingContext.currentSpan)) {
    return mastra;
  }

  // Check if this object has the methods we want to wrap - if not, return as is
  if (!isMastra(mastra)) {
    return mastra;
  }

  try {
    const proxy = new Proxy(mastra, {
      get(target, prop) {
        try {
          if (AGENT_GETTERS.includes(prop as string)) {
            return (...args: any[]) => {
              const agent = (target as any)[prop](...args);
              return wrapAgent(agent, tracingContext);
            };
          }

          // Wrap workflow getters
          if (WORKFLOW_GETTERS.includes(prop as string)) {
            return (...args: any[]) => {
              const workflow = (target as any)[prop](...args);
              return wrapWorkflow(workflow, tracingContext);
            };
          }

          // Pass through all other methods unchanged - bind functions to preserve 'this' context
          const value = (target as any)[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        } catch (error) {
          console.warn('Tracing: Failed to wrap method, falling back to original', error);
          const value = (target as any)[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        }
      },
    });
    tracingProxyTargets.set(proxy, mastra);
    return proxy;
  } catch (error) {
    console.warn('Tracing: Failed to create proxy, using original Mastra instance', error);
    return mastra;
  }
}

/**
 * Resolve a tracing proxy back to the underlying instance. Returns the argument
 * unchanged when it is not a proxy this module created. Transitive: a tool
 * executed inside a traced workflow step receives an already-wrapped mastra and
 * `tools/tool-builder/builder.ts` wraps it again, so nesting is real.
 */
export function unwrapMastraTracingProxy<T>(mastra: T): T {
  let current: any = mastra;
  let target = tracingProxyTargets.get(current);
  while (target) {
    current = target;
    target = tracingProxyTargets.get(current);
  }
  return current as T;
}

/**
 * Creates a tracing-aware Agent proxy that automatically injects
 * tracing context into generation method calls
 */
function wrapAgent<T extends Agent>(agent: T, tracingContext: TracingContext): T {
  // Don't wrap if no current span or if using NoOp span
  if (!tracingContext.currentSpan || isNoOpSpan(tracingContext.currentSpan)) {
    return agent;
  }

  try {
    return new Proxy(agent, {
      get(target, prop) {
        try {
          if (AGENT_METHODS_TO_WRAP.includes(prop as string)) {
            return (input: any, options: any = {}) => {
              return (target as any)[prop](input, {
                ...options,
                ...createObservabilityContext(tracingContext),
              });
            };
          }

          // Bind functions to preserve 'this' context for private member access
          const value = (target as any)[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        } catch (error) {
          console.warn('Tracing: Failed to wrap agent method, falling back to original', error);
          const value = (target as any)[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        }
      },
    });
  } catch (error) {
    console.warn('Tracing: Failed to create agent proxy, using original instance', error);
    return agent;
  }
}

/**
 * Creates a tracing-aware Workflow proxy that automatically injects
 * tracing context into execution method calls
 */
function wrapWorkflow<T extends Workflow>(workflow: T, tracingContext: TracingContext): T {
  // Don't wrap if no current span or if using NoOp span
  if (!tracingContext.currentSpan || isNoOpSpan(tracingContext.currentSpan)) {
    return workflow;
  }

  try {
    return new Proxy(workflow, {
      get(target, prop) {
        try {
          // Wrap workflow execution methods with tracing context
          if (WORKFLOW_METHODS_TO_WRAP.includes(prop as string)) {
            // Handle createRun and createRun methods differently
            if (prop === 'createRun' || prop === 'createRun') {
              return async (options: any = {}) => {
                const run = await (target as any)[prop](options);
                return run ? wrapRun(run, tracingContext) : run;
              };
            }

            // Handle other methods like execute
            return (input: any, options: any = {}) => {
              return (target as any)[prop](input, {
                ...options,
                ...createObservabilityContext(tracingContext),
              });
            };
          }

          // Bind functions to preserve 'this' context for private member access
          const value = (target as any)[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        } catch (error) {
          console.warn('Tracing: Failed to wrap workflow method, falling back to original', error);
          const value = (target as any)[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        }
      },
    });
  } catch (error) {
    console.warn('Tracing: Failed to create workflow proxy, using original instance', error);
    return workflow;
  }
}

/**
 * Creates a tracing-aware Run proxy that automatically injects
 * tracing context into start method calls
 */
function wrapRun<T extends object>(run: T, tracingContext: TracingContext): T {
  // Don't wrap if no current span or if using NoOp span
  if (!tracingContext.currentSpan || isNoOpSpan(tracingContext.currentSpan)) {
    return run;
  }

  try {
    return new Proxy(run, {
      get(target, prop) {
        try {
          if (prop === 'start') {
            return (startOptions: any = {}) => {
              return (target as any).start({
                ...startOptions,
                ...createObservabilityContext(startOptions.tracingContext ?? tracingContext),
              });
            };
          }

          // Pass through all other properties and methods unchanged
          const value = (target as any)[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        } catch (error) {
          console.warn('Tracing: Failed to wrap run method, falling back to original', error);
          const value = (target as any)[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        }
      },
    });
  } catch (error) {
    console.warn('Tracing: Failed to create run proxy, using original instance', error);
    return run;
  }
}
