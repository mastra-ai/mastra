/**
 * AI Tracing Context Integration
 *
 * This module provides automatic AI tracing context propagation throughout Mastra's execution contexts.
 * It uses JavaScript Proxies to transparently wrap Mastra, Agent, and Workflow instances so that
 * tracing context is automatically injected without requiring manual passing by users.
 */

import type { Agent } from '../agent';
import type { Mastra } from '../mastra';
import type { Workflow } from '../workflows';
import type { TracingContext, AnyAISpan } from './types';

const AGENT_GETTERS = ['getAgent', 'getAgentById'];
const AGENT_METHODS_TO_WRAP = ['generate', 'stream', 'generateVNext', 'streamVNext'];

const WORKFLOW_GETTERS = ['getWorkflow', 'getWorkflowById'];
const WORKFLOW_METHODS_TO_WRAP = ['execute'];

/**
 * Helper function to detect NoOp spans to avoid unnecessary wrapping
 */
function isNoOpSpan(span: AnyAISpan): boolean {
  // Check if this is a NoOp span implementation
  return (
    span.constructor.name === 'NoOpAISpan' || (span as any).__isNoOp === true || !span.aiTracing // NoOp spans might not have aiTracing reference
  );
}

/**
 * Creates a tracing-aware Mastra proxy that automatically injects
 * AI tracing context into agent and workflow method calls
 */
export function wrapMastra<T extends Mastra>(mastra: T, tracingContext: TracingContext): T {
  // Don't wrap if no current span or if using NoOp span
  if (!tracingContext.currentSpan || isNoOpSpan(tracingContext.currentSpan)) {
    return mastra;
  }

  try {
    return new Proxy(mastra, {
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
          console.warn('AI Tracing: Failed to wrap method, falling back to original', error);
          const value = (target as any)[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        }
      },
    });
  } catch (error) {
    console.warn('AI Tracing: Failed to create proxy, using original Mastra instance', error);
    return mastra;
  }
}

/**
 * Creates a tracing-aware Agent proxy that automatically injects
 * AI tracing context into generation method calls
 */
export function wrapAgent<T extends Agent>(agent: T, tracingContext: TracingContext): T {
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
                tracingContext,
              });
            };
          }

          // Bind functions to preserve 'this' context for private member access
          const value = (target as any)[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        } catch (error) {
          console.warn('AI Tracing: Failed to wrap agent method, falling back to original', error);
          const value = (target as any)[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        }
      },
    });
  } catch (error) {
    console.warn('AI Tracing: Failed to create agent proxy, using original instance', error);
    return agent;
  }
}

/**
 * Creates a tracing-aware Workflow proxy that automatically injects
 * AI tracing context into execution method calls
 */
export function wrapWorkflow<T extends Workflow>(workflow: T, tracingContext: TracingContext): T {
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
            return (input: any, options: any = {}) => {
              return (target as any)[prop](input, {
                ...options,
                tracingContext,
              });
            };
          }

          // Bind functions to preserve 'this' context for private member access
          const value = (target as any)[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        } catch (error) {
          console.warn('AI Tracing: Failed to wrap workflow method, falling back to original', error);
          const value = (target as any)[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        }
      },
    });
  } catch (error) {
    console.warn('AI Tracing: Failed to create workflow proxy, using original instance', error);
    return workflow;
  }
}
