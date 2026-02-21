/**
 * Permission Derivation Tests
 *
 * Tests for the convention-based permission derivation system that automatically
 * assigns permissions to routes based on their path and HTTP method.
 */

import { describe, expect, it } from 'vitest';
import { extractResource, deriveAction, derivePermission, getEffectivePermission } from './permissions';
import type { ServerRoute } from './index';

describe('extractResource', () => {
  describe('known resources', () => {
    it('should extract agents from /agents', () => {
      expect(extractResource('/agents')).toBe('agents');
    });

    it('should extract agents from /agents/:agentId', () => {
      expect(extractResource('/agents/:agentId')).toBe('agents');
    });

    it('should extract agents from nested path /agents/:agentId/generate', () => {
      expect(extractResource('/agents/:agentId/generate')).toBe('agents');
    });

    it('should extract workflows from /workflows', () => {
      expect(extractResource('/workflows')).toBe('workflows');
    });

    it('should extract workflows from /workflows/:workflowId/runs/:runId', () => {
      expect(extractResource('/workflows/:workflowId/runs/:runId')).toBe('workflows');
    });

    it('should extract tools from /tools', () => {
      expect(extractResource('/tools')).toBe('tools');
    });

    it('should extract tools from /tools/:toolId/execute', () => {
      expect(extractResource('/tools/:toolId/execute')).toBe('tools');
    });

    it('should extract memory from /memory/threads', () => {
      expect(extractResource('/memory/threads')).toBe('memory');
    });

    it('should extract memory from /memory/threads/:threadId/messages', () => {
      expect(extractResource('/memory/threads/:threadId/messages')).toBe('memory');
    });

    it('should extract mcp from /mcp/servers', () => {
      expect(extractResource('/mcp/servers')).toBe('mcp');
    });

    it('should extract vectors from /vectors', () => {
      expect(extractResource('/vectors')).toBe('vectors');
    });

    it('should extract vector from /vector (singular)', () => {
      expect(extractResource('/vector')).toBe('vector');
    });

    it('should extract logs from /logs', () => {
      expect(extractResource('/logs')).toBe('logs');
    });

    it('should extract observability from /observability/traces', () => {
      expect(extractResource('/observability/traces')).toBe('observability');
    });

    it('should extract scores from /scores', () => {
      expect(extractResource('/scores')).toBe('scores');
    });

    it('should extract processors from /processors', () => {
      expect(extractResource('/processors')).toBe('processors');
    });

    it('should extract agent-builder from /agent-builder', () => {
      expect(extractResource('/agent-builder')).toBe('agent-builder');
    });

    it('should extract agent-builder from /agent-builder/:actionId/stream', () => {
      expect(extractResource('/agent-builder/:actionId/stream')).toBe('agent-builder');
    });

    it('should extract workspaces from /workspaces', () => {
      expect(extractResource('/workspaces')).toBe('workspaces');
    });

    it('should extract a2a from /a2a/:agentId', () => {
      expect(extractResource('/a2a/:agentId')).toBe('a2a');
    });

    it('should extract system from /system', () => {
      expect(extractResource('/system')).toBe('system');
    });
  });

  describe('special cases', () => {
    it('should extract stored-agents from /stored/agents', () => {
      expect(extractResource('/stored/agents')).toBe('stored-agents');
    });

    it('should extract stored-agents from /stored/agents/:agentId', () => {
      expect(extractResource('/stored/agents/:agentId')).toBe('stored-agents');
    });

    it('should extract a2a from /.well-known paths', () => {
      expect(extractResource('/.well-known/:agentId/agent-card.json')).toBe('a2a');
    });
  });

  describe('unknown resources', () => {
    it('should return first segment for unknown resource', () => {
      expect(extractResource('/custom/endpoint')).toBe('custom');
    });

    it('should return first segment for unknown nested path', () => {
      expect(extractResource('/metrics/agents/count')).toBe('metrics');
    });
  });

  describe('edge cases', () => {
    it('should return null for empty path', () => {
      expect(extractResource('')).toBe(null);
    });

    it('should return null for root path', () => {
      expect(extractResource('/')).toBe(null);
    });

    it('should handle path without leading slash', () => {
      expect(extractResource('agents/:agentId')).toBe('agents');
    });
  });
});

describe('deriveAction', () => {
  describe('basic HTTP method mapping', () => {
    it('should derive read for GET requests', () => {
      expect(deriveAction('GET', '/agents')).toBe('read');
    });

    it('should derive write for PUT requests', () => {
      expect(deriveAction('PUT', '/agents/:agentId')).toBe('write');
    });

    it('should derive write for PATCH requests', () => {
      expect(deriveAction('PATCH', '/agents/:agentId')).toBe('write');
    });

    it('should derive delete for DELETE requests', () => {
      expect(deriveAction('DELETE', '/agents/:agentId')).toBe('delete');
    });

    it('should default to read for unknown methods', () => {
      expect(deriveAction('OPTIONS', '/agents')).toBe('read');
    });
  });

  describe('POST request action derivation', () => {
    it('should derive write for basic POST without execute pattern', () => {
      expect(deriveAction('POST', '/agents')).toBe('write');
    });

    it('should derive write for POST to /runs', () => {
      expect(deriveAction('POST', '/workflows/:workflowId/runs')).toBe('write');
    });

    it('should derive execute for POST with /generate pattern', () => {
      expect(deriveAction('POST', '/agents/:agentId/generate')).toBe('execute');
    });

    it('should derive execute for POST with /stream pattern', () => {
      expect(deriveAction('POST', '/agents/:agentId/stream')).toBe('execute');
    });

    it('should derive execute for POST with /execute pattern', () => {
      expect(deriveAction('POST', '/tools/:toolId/execute')).toBe('execute');
    });

    it('should derive execute for POST with /start pattern', () => {
      expect(deriveAction('POST', '/workflows/:workflowId/start')).toBe('execute');
    });

    it('should derive execute for POST with /resume pattern', () => {
      expect(deriveAction('POST', '/workflows/:workflowId/resume')).toBe('execute');
    });

    it('should derive execute for POST with /restart pattern', () => {
      expect(deriveAction('POST', '/workflows/:workflowId/restart')).toBe('execute');
    });

    it('should derive execute for POST with /cancel pattern', () => {
      expect(deriveAction('POST', '/workflows/:workflowId/runs/:runId/cancel')).toBe('execute');
    });

    it('should derive execute for POST with /approve pattern', () => {
      expect(deriveAction('POST', '/agents/:agentId/approve-tool-call')).toBe('execute');
    });

    it('should derive execute for POST with /decline pattern', () => {
      expect(deriveAction('POST', '/agents/:agentId/decline-tool-call')).toBe('execute');
    });

    it('should derive execute for POST with /speak pattern', () => {
      expect(deriveAction('POST', '/agents/:agentId/speak')).toBe('execute');
    });

    it('should derive execute for POST with /listen pattern', () => {
      expect(deriveAction('POST', '/agents/:agentId/listen')).toBe('execute');
    });

    it('should derive execute for POST with /query pattern', () => {
      expect(deriveAction('POST', '/vectors/query')).toBe('execute');
    });

    it('should derive execute for POST with /search pattern', () => {
      expect(deriveAction('POST', '/memory/search')).toBe('execute');
    });

    it('should derive execute for POST with /observe pattern', () => {
      expect(deriveAction('POST', '/workflows/:workflowId/observe')).toBe('execute');
    });

    it('should derive execute for POST with /time-travel pattern', () => {
      expect(deriveAction('POST', '/workflows/:workflowId/time-travel')).toBe('execute');
    });

    it('should derive execute for POST with /enhance pattern', () => {
      expect(deriveAction('POST', '/agents/:agentId/instructions/enhance')).toBe('execute');
    });

    it('should derive execute for POST with /clone pattern', () => {
      expect(deriveAction('POST', '/agents/:agentId/clone')).toBe('execute');
    });
  });

  describe('case insensitivity', () => {
    it('should handle lowercase method', () => {
      expect(deriveAction('get', '/agents')).toBe('read');
    });

    it('should handle mixed case method', () => {
      expect(deriveAction('Get', '/agents')).toBe('read');
    });

    it('should handle lowercase post with execute pattern', () => {
      expect(deriveAction('post', '/agents/:agentId/generate')).toBe('execute');
    });
  });
});

describe('derivePermission', () => {
  describe('successful derivation', () => {
    it('should derive agents:read for GET /agents', () => {
      expect(derivePermission({ path: '/agents', method: 'GET' })).toBe('agents:read');
    });

    it('should derive agents:read for GET /agents/:agentId', () => {
      expect(derivePermission({ path: '/agents/:agentId', method: 'GET' })).toBe('agents:read');
    });

    it('should derive agents:execute for POST /agents/:agentId/generate', () => {
      expect(derivePermission({ path: '/agents/:agentId/generate', method: 'POST' })).toBe('agents:execute');
    });

    it('should derive agents:write for POST /agents', () => {
      expect(derivePermission({ path: '/agents', method: 'POST' })).toBe('agents:write');
    });

    it('should derive agents:delete for DELETE /agents/:agentId', () => {
      expect(derivePermission({ path: '/agents/:agentId', method: 'DELETE' })).toBe('agents:delete');
    });

    it('should derive workflows:read for GET /workflows', () => {
      expect(derivePermission({ path: '/workflows', method: 'GET' })).toBe('workflows:read');
    });

    it('should derive workflows:execute for POST /workflows/:id/start', () => {
      expect(derivePermission({ path: '/workflows/:workflowId/start', method: 'POST' })).toBe('workflows:execute');
    });

    it('should derive workflows:delete for DELETE /workflows/:id/runs/:runId', () => {
      expect(derivePermission({ path: '/workflows/:workflowId/runs/:runId', method: 'DELETE' })).toBe(
        'workflows:delete',
      );
    });

    it('should derive tools:read for GET /tools', () => {
      expect(derivePermission({ path: '/tools', method: 'GET' })).toBe('tools:read');
    });

    it('should derive tools:read for GET /tools/:toolId', () => {
      expect(derivePermission({ path: '/tools/:toolId', method: 'GET' })).toBe('tools:read');
    });

    it('should derive tools:execute for POST /tools/:toolId/execute', () => {
      expect(derivePermission({ path: '/tools/:toolId/execute', method: 'POST' })).toBe('tools:execute');
    });

    it('should derive memory:read for GET /memory/threads', () => {
      expect(derivePermission({ path: '/memory/threads', method: 'GET' })).toBe('memory:read');
    });

    it('should derive memory:write for POST /memory/threads', () => {
      expect(derivePermission({ path: '/memory/threads', method: 'POST' })).toBe('memory:write');
    });

    it('should derive stored-agents:read for GET /stored/agents', () => {
      expect(derivePermission({ path: '/stored/agents', method: 'GET' })).toBe('stored-agents:read');
    });

    it('should derive stored-agents:write for POST /stored/agents', () => {
      expect(derivePermission({ path: '/stored/agents', method: 'POST' })).toBe('stored-agents:write');
    });

    it('should derive a2a:read for GET /.well-known/:agentId/agent-card.json', () => {
      expect(derivePermission({ path: '/.well-known/:agentId/agent-card.json', method: 'GET' })).toBe('a2a:read');
    });
  });

  describe('ALL method handling', () => {
    it('should return null for ALL method (MCP transport)', () => {
      expect(derivePermission({ path: '/mcp', method: 'ALL' })).toBe(null);
    });
  });

  describe('empty path handling', () => {
    it('should return null for root path', () => {
      expect(derivePermission({ path: '/', method: 'GET' })).toBe(null);
    });
  });
});

describe('getEffectivePermission', () => {
  const createRoute = (overrides: Partial<ServerRoute>): ServerRoute =>
    ({
      method: 'GET',
      path: '/agents',
      responseType: 'json',
      handler: async () => ({}),
      ...overrides,
    }) as ServerRoute;

  describe('explicit permission', () => {
    it('should use explicit requiresPermission when set', () => {
      const route = createRoute({
        path: '/agents',
        method: 'GET',
        requiresPermission: 'custom:permission',
      });
      expect(getEffectivePermission(route)).toBe('custom:permission');
    });

    it('should prefer explicit over derived permission', () => {
      const route = createRoute({
        path: '/agents/:agentId/generate',
        method: 'POST',
        requiresPermission: 'agents:admin',
      });
      // Would derive to agents:execute, but explicit takes precedence
      expect(getEffectivePermission(route)).toBe('agents:admin');
    });
  });

  describe('public routes', () => {
    it('should return null for public routes (requiresAuth: false)', () => {
      const route = createRoute({
        path: '/agents',
        method: 'GET',
        requiresAuth: false,
      });
      expect(getEffectivePermission(route)).toBe(null);
    });

    it('should return null for public routes even with explicit permission', () => {
      const route = createRoute({
        path: '/agents',
        method: 'GET',
        requiresAuth: false,
        requiresPermission: 'agents:read',
      });
      // Public takes precedence - no permission check needed
      expect(getEffectivePermission(route)).toBe(null);
    });
  });

  describe('derived permissions', () => {
    it('should derive permission when not explicitly set', () => {
      const route = createRoute({
        path: '/agents',
        method: 'GET',
      });
      expect(getEffectivePermission(route)).toBe('agents:read');
    });

    it('should derive execute permission for operation routes', () => {
      const route = createRoute({
        path: '/agents/:agentId/generate',
        method: 'POST',
      });
      expect(getEffectivePermission(route)).toBe('agents:execute');
    });

    it('should derive write permission for data creation routes', () => {
      const route = createRoute({
        path: '/workflows/:workflowId/runs',
        method: 'POST',
      });
      expect(getEffectivePermission(route)).toBe('workflows:write');
    });

    it('should derive delete permission for DELETE routes', () => {
      const route = createRoute({
        path: '/workflows/:workflowId/runs/:runId',
        method: 'DELETE',
      });
      expect(getEffectivePermission(route)).toBe('workflows:delete');
    });
  });

  describe('edge cases', () => {
    it('should return null for ALL method routes', () => {
      const route = createRoute({
        path: '/mcp/transport',
        method: 'ALL',
      });
      expect(getEffectivePermission(route)).toBe(null);
    });

    it('should handle undefined requiresAuth (defaults to protected)', () => {
      const route = createRoute({
        path: '/agents',
        method: 'GET',
        requiresAuth: undefined,
      });
      expect(getEffectivePermission(route)).toBe('agents:read');
    });
  });
});

describe('real route scenarios', () => {
  // These tests verify that actual route patterns from the codebase
  // derive the expected permissions

  describe('agent routes', () => {
    it('GET /agents → agents:read', () => {
      expect(derivePermission({ path: '/agents', method: 'GET' })).toBe('agents:read');
    });

    it('GET /agents/:agentId → agents:read', () => {
      expect(derivePermission({ path: '/agents/:agentId', method: 'GET' })).toBe('agents:read');
    });

    it('POST /agents/:agentId/generate → agents:execute', () => {
      expect(derivePermission({ path: '/agents/:agentId/generate', method: 'POST' })).toBe('agents:execute');
    });

    it('POST /agents/:agentId/stream → agents:execute', () => {
      expect(derivePermission({ path: '/agents/:agentId/stream', method: 'POST' })).toBe('agents:execute');
    });

    it('POST /agents/:agentId/approve-tool-call → agents:execute', () => {
      expect(derivePermission({ path: '/agents/:agentId/approve-tool-call', method: 'POST' })).toBe('agents:execute');
    });

    it('POST /agents/:agentId/speak → agents:execute', () => {
      expect(derivePermission({ path: '/agents/:agentId/speak', method: 'POST' })).toBe('agents:execute');
    });

    it('PUT /agents/:agentId/model → agents:write', () => {
      expect(derivePermission({ path: '/agents/:agentId/model', method: 'PUT' })).toBe('agents:write');
    });
  });

  describe('workflow routes', () => {
    it('GET /workflows → workflows:read', () => {
      expect(derivePermission({ path: '/workflows', method: 'GET' })).toBe('workflows:read');
    });

    it('GET /workflows/:workflowId → workflows:read', () => {
      expect(derivePermission({ path: '/workflows/:workflowId', method: 'GET' })).toBe('workflows:read');
    });

    it('GET /workflows/:workflowId/runs → workflows:read', () => {
      expect(derivePermission({ path: '/workflows/:workflowId/runs', method: 'GET' })).toBe('workflows:read');
    });

    it('POST /workflows/:workflowId/runs → workflows:write (create run)', () => {
      expect(derivePermission({ path: '/workflows/:workflowId/runs', method: 'POST' })).toBe('workflows:write');
    });

    it('POST /workflows/:workflowId/start → workflows:execute', () => {
      expect(derivePermission({ path: '/workflows/:workflowId/start', method: 'POST' })).toBe('workflows:execute');
    });

    it('POST /workflows/:workflowId/stream → workflows:execute', () => {
      expect(derivePermission({ path: '/workflows/:workflowId/stream', method: 'POST' })).toBe('workflows:execute');
    });

    it('POST /workflows/:workflowId/resume → workflows:execute', () => {
      expect(derivePermission({ path: '/workflows/:workflowId/resume', method: 'POST' })).toBe('workflows:execute');
    });

    it('POST /workflows/:workflowId/restart → workflows:execute', () => {
      expect(derivePermission({ path: '/workflows/:workflowId/restart', method: 'POST' })).toBe('workflows:execute');
    });

    it('POST /workflows/:workflowId/time-travel → workflows:execute', () => {
      expect(derivePermission({ path: '/workflows/:workflowId/time-travel', method: 'POST' })).toBe(
        'workflows:execute',
      );
    });

    it('POST /workflows/:workflowId/runs/:runId/cancel → workflows:execute', () => {
      expect(derivePermission({ path: '/workflows/:workflowId/runs/:runId/cancel', method: 'POST' })).toBe(
        'workflows:execute',
      );
    });

    it('DELETE /workflows/:workflowId/runs/:runId → workflows:delete', () => {
      expect(derivePermission({ path: '/workflows/:workflowId/runs/:runId', method: 'DELETE' })).toBe(
        'workflows:delete',
      );
    });
  });

  describe('tool routes', () => {
    it('GET /tools → tools:read', () => {
      expect(derivePermission({ path: '/tools', method: 'GET' })).toBe('tools:read');
    });

    it('GET /tools/:toolId → tools:read', () => {
      expect(derivePermission({ path: '/tools/:toolId', method: 'GET' })).toBe('tools:read');
    });

    it('POST /tools/:toolId/execute → tools:execute', () => {
      expect(derivePermission({ path: '/tools/:toolId/execute', method: 'POST' })).toBe('tools:execute');
    });
  });

  describe('memory routes', () => {
    it('GET /memory/threads → memory:read', () => {
      expect(derivePermission({ path: '/memory/threads', method: 'GET' })).toBe('memory:read');
    });

    it('POST /memory/threads → memory:write', () => {
      expect(derivePermission({ path: '/memory/threads', method: 'POST' })).toBe('memory:write');
    });

    it('DELETE /memory/threads/:threadId → memory:delete', () => {
      expect(derivePermission({ path: '/memory/threads/:threadId', method: 'DELETE' })).toBe('memory:delete');
    });
  });

  describe('agent-builder routes', () => {
    it('GET /agent-builder → agent-builder:read', () => {
      expect(derivePermission({ path: '/agent-builder', method: 'GET' })).toBe('agent-builder:read');
    });

    it('POST /agent-builder/:actionId/stream → agent-builder:execute', () => {
      expect(derivePermission({ path: '/agent-builder/:actionId/stream', method: 'POST' })).toBe(
        'agent-builder:execute',
      );
    });

    it('POST /agent-builder/:actionId/start → agent-builder:execute', () => {
      expect(derivePermission({ path: '/agent-builder/:actionId/start', method: 'POST' })).toBe(
        'agent-builder:execute',
      );
    });
  });

  describe('observability routes', () => {
    it('GET /observability/traces → observability:read', () => {
      expect(derivePermission({ path: '/observability/traces', method: 'GET' })).toBe('observability:read');
    });
  });
});
