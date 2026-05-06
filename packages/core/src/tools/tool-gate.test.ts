import { describe, expect, it } from 'vitest';
import { RequestContext } from '../request-context';
import {
  appendToolGateDecision,
  clearToolGateRuntimeState,
  createProviderToolGateSubject,
  createToolGateDecisionRecord,
  createToolGateSubject,
  evaluateToolGatePolicy,
  getToolGateRuntimeState,
  hydrateToolGateRuntimeState,
  serializeToolGateRuntimeState,
  setToolGateRuntimeState,
} from './tool-gate';
import type { CoreTool } from './types';

describe('tool gate subjects', () => {
  it('keeps local tool source information explicit', () => {
    const subject = createToolGateSubject({
      boundary: 'model-input',
      toolName: 'agent-researcher',
      tool: {
        id: 'agent-researcher',
        description: 'Delegate research',
      },
      source: {
        source: 'agent',
        primitiveId: 'researcher',
      },
    });

    expect(subject).toMatchObject({
      boundary: 'model-input',
      toolName: 'agent-researcher',
      toolId: 'agent-researcher',
      description: 'Delegate research',
      source: {
        source: 'agent',
        primitiveId: 'researcher',
      },
    });
  });

  it('captures provider tool ids without treating them like function tools', () => {
    const subject = createProviderToolGateSubject({
      boundary: 'tool-call',
      toolName: 'web_search',
      tool: {
        id: 'openai.web_search',
        name: 'web_search',
        description: 'Search the web',
        args: { search_context_size: 'medium' },
      } as Partial<CoreTool> & { id: string; name: string; args: Record<string, unknown> },
    });

    expect(subject).toMatchObject({
      boundary: 'tool-call',
      toolName: 'web_search',
      toolId: 'openai.web_search',
      source: {
        source: 'provider',
        providerToolId: 'openai.web_search',
        providerName: 'openai',
        modelFacingName: 'web_search',
      },
      provider: {
        id: 'openai.web_search',
        args: { search_context_size: 'medium' },
      },
    });
  });

  it('preserves MCP metadata separately from the source', () => {
    const subject = createToolGateSubject({
      boundary: 'dynamic-load',
      toolName: 'list_files',
      tool: {
        id: 'list_files',
        mcpMetadata: {
          serverName: 'filesystem',
          serverVersion: '1.0.0',
        },
        mcp: {
          toolType: 'agent',
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
          },
        },
      },
      source: {
        source: 'mcp',
        serverName: 'filesystem',
        serverVersion: '1.0.0',
        toolType: 'agent',
      },
    });

    expect(subject).toMatchObject({
      source: {
        source: 'mcp',
        serverName: 'filesystem',
        serverVersion: '1.0.0',
        toolType: 'agent',
      },
      mcp: {
        metadata: {
          serverName: 'filesystem',
          serverVersion: '1.0.0',
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
        },
      },
    });
  });
});

describe('tool gate runtime state', () => {
  it('evaluates policies into auditable decision records', async () => {
    const subject = createToolGateSubject({
      boundary: 'tool-call',
      toolName: 'sendEmail',
      source: { source: 'client' },
    });

    const record = await evaluateToolGatePolicy({
      policy: {
        id: 'workspace-policy',
        evaluate: evaluation => ({
          effect: 'requireApproval',
          reason: `${evaluation.subject.toolName} crosses a workspace boundary`,
          ruleId: 'external-write',
        }),
      },
      evaluation: {
        subject,
        runId: 'run-1',
        threadId: 'thread-1',
        resourceId: 'resource-1',
        toolCallId: 'tool-call-1',
      },
      evaluatedAt: '2026-05-06T00:00:00.000Z',
    });

    expect(record).toMatchObject({
      effect: 'requireApproval',
      reason: 'sendEmail crosses a workspace boundary',
      ruleId: 'external-write',
      policyId: 'workspace-policy',
      runId: 'run-1',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      toolCallId: 'tool-call-1',
      evaluatedAt: '2026-05-06T00:00:00.000Z',
      subject,
    });
  });

  it('stores gate state outside public RequestContext entries and JSON', () => {
    const requestContext = new RequestContext([['publicKey', 'publicValue']]);
    const subject = createToolGateSubject({
      boundary: 'model-input',
      toolName: 'deleteUser',
      source: { source: 'assigned' },
    });

    setToolGateRuntimeState(requestContext, {
      policy: {
        id: 'tenant-policy',
        evaluate: () => ({ effect: 'deny', reason: 'tenant rule' }),
      },
      decisions: [
        createToolGateDecisionRecord({
          subject,
          policyId: 'tenant-policy',
          decision: {
            effect: 'deny',
            reason: 'tenant rule',
            ruleId: 'no-delete-user',
          },
          evaluatedAt: '2026-05-06T00:00:00.000Z',
        }),
      ],
    });

    expect(requestContext.all).toEqual({ publicKey: 'publicValue' });
    expect(Object.fromEntries(requestContext.entries())).toEqual({ publicKey: 'publicValue' });
    expect(requestContext.toJSON()).toEqual({ publicKey: 'publicValue' });
    expect(getToolGateRuntimeState(requestContext)?.policy?.id).toBe('tenant-policy');
  });

  it('does not expose stored state by reference', () => {
    const requestContext = new RequestContext();
    const subject = createToolGateSubject({
      boundary: 'tool-call',
      toolName: 'sendEmail',
      source: { source: 'client' },
    });
    const metadata = { nested: { value: 'original' } };

    setToolGateRuntimeState(requestContext, {
      decisions: [
        createToolGateDecisionRecord({
          subject,
          decision: { effect: 'allow', reason: 'safe client tool', metadata },
          evaluatedAt: '2026-05-06T00:00:00.000Z',
        }),
      ],
    });

    const firstRead = getToolGateRuntimeState(requestContext);
    (firstRead?.decisions?.[0]?.metadata?.nested as { value: string }).value = 'mutated';
    firstRead?.decisions?.push(
      createToolGateDecisionRecord({
        subject,
        decision: { effect: 'deny', reason: 'mutated copy' },
      }),
    );

    expect(getToolGateRuntimeState(requestContext)?.decisions).toHaveLength(1);
    expect(getToolGateRuntimeState(requestContext)?.decisions?.[0]?.metadata).toEqual(metadata);
  });

  it('appends decisions without exposing state through RequestContext', () => {
    const requestContext = new RequestContext();
    const subject = createToolGateSubject({
      boundary: 'dynamic-search',
      toolName: 'searchIssues',
      source: {
        source: 'dynamic',
        catalogName: 'github',
      },
    });

    appendToolGateDecision(
      requestContext,
      createToolGateDecisionRecord({
        subject,
        decision: { effect: 'requireApproval', reason: 'external write capability' },
        toolCallId: 'tool-call-1',
        evaluatedAt: '2026-05-06T00:00:00.000Z',
      }),
    );

    expect(requestContext.size()).toBe(0);
    expect(getToolGateRuntimeState(requestContext)?.decisions?.[0]).toMatchObject({
      effect: 'requireApproval',
      toolCallId: 'tool-call-1',
    });

    clearToolGateRuntimeState(requestContext);
    expect(getToolGateRuntimeState(requestContext)).toBeUndefined();
  });
});

describe('tool gate durable state shape', () => {
  it('serializes only durable-safe policy identity and decisions', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const providerArgs = {
      kept: { nested: 'arg' },
      droppedNested: { fn: () => true },
      droppedCircular: circular,
    };
    const subject = createProviderToolGateSubject({
      boundary: 'tool-call',
      toolName: 'web_search',
      tool: {
        id: 'openai.web_search',
        args: providerArgs,
      } as Partial<CoreTool> & { id: string; args: Record<string, unknown> },
    });

    const serialized = serializeToolGateRuntimeState({
      policy: {
        id: 'workspace-policy',
        evaluate: () => ({ effect: 'allow', reason: 'test policy' }),
      },
      policyRevision: 'rev-1',
      resumeRule: 'narrow-on-resume',
      decisions: [
        createToolGateDecisionRecord({
          subject,
          decision: {
            effect: 'allow',
            reason: 'workflow allowed',
            metadata: {
              kept: { nested: true, droppedNestedFunction: () => true },
              droppedFunction: () => true,
              droppedSymbol: Symbol('tool-gate'),
              droppedCircular: circular,
            },
          },
          evaluatedAt: '2026-05-06T00:00:00.000Z',
        }),
      ],
    });

    expect(serialized).toEqual({
      policyId: 'workspace-policy',
      policyRevision: 'rev-1',
      resumeRule: 'narrow-on-resume',
      decisions: [
        expect.objectContaining({
          effect: 'allow',
          reason: 'workflow allowed',
          metadata: {
            kept: { nested: true },
          },
          subject: {
            ...subject,
            provider: {
              id: 'openai.web_search',
              args: {
                kept: { nested: 'arg' },
              },
            },
          },
        }),
      ],
    });
    providerArgs.kept.nested = 'mutated';
    expect(serialized?.decisions?.[0]?.subject.provider?.args).toEqual({
      kept: { nested: 'arg' },
    });
    expect(JSON.stringify(serialized)).toContain('workspace-policy');
    expect(serialized).not.toHaveProperty('policy');
  });

  it('preserves durable policy identity when hydrating without an evaluator', () => {
    const runtimeState = hydrateToolGateRuntimeState({
      serialized: {
        policyId: 'workspace-policy',
        policyRevision: 'rev-1',
      },
    });

    expect(runtimeState).toMatchObject({
      policyId: 'workspace-policy',
      policyRevision: 'rev-1',
    });
    expect(serializeToolGateRuntimeState(runtimeState)).toMatchObject({
      policyId: 'workspace-policy',
      policyRevision: 'rev-1',
    });
  });

  it('hydrates serialized decisions with a re-provided evaluator', () => {
    const runtimeState = hydrateToolGateRuntimeState({
      serialized: {
        policyId: 'workspace-policy',
        policyRevision: 'rev-1',
        resumeRule: 'original-policy-only',
        decisions: [],
      },
      policy: {
        id: 'workspace-policy',
        evaluate: () => ({ effect: 'deny', reason: 'rehydrated policy' }),
      },
    });

    expect(runtimeState).toMatchObject({
      policy: {
        id: 'workspace-policy',
      },
      policyRevision: 'rev-1',
      resumeRule: 'original-policy-only',
      decisions: [],
    });
    expect(
      runtimeState?.policy?.evaluate({
        subject: createToolGateSubject({ boundary: 'tool-call', toolName: 'x', source: { source: 'unknown' } }),
      }),
    ).toEqual({
      effect: 'deny',
      reason: 'rehydrated policy',
    });
  });

  it('rejects hydration with an unrelated policy id', () => {
    expect(() =>
      hydrateToolGateRuntimeState({
        serialized: {
          policyId: 'original-policy',
        },
        policy: {
          id: 'other-policy',
          evaluate: () => ({ effect: 'allow', reason: 'wrong policy' }),
        },
      }),
    ).toThrow(
      'Tool Gate policyId mismatch: serialized policyId "original-policy" does not match provided policy id "other-policy".',
    );
  });
});
