import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Mastra } from '../mastra/index';
import { MCPServerBase } from '.';
import type { MCPServerConfig } from '.';

// A concrete mock implementation of MCPServerBase for testing
class MockMCPServer extends MCPServerBase {
  constructor(config: MCPServerConfig) {
    super(config);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  convertTools(tools: any) {
    return {};
  }
  async startStdio() {
    /* no-op */
  }
  async startSSE() {
    /* no-op */
  }
  async startHonoSSE() {
    return undefined; /* no-op */
  }
  async startHTTP() {
    /* no-op */
  }
  async close() {
    /* no-op */
  }
  getServerInfo() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      repository: this.repository,
      version_detail: {
        version: this.version,
        release_date: this.releaseDate,
        is_latest: this.isLatest,
      },
    };
  }
  getServerDetail() {
    return {
      ...this.getServerInfo(),
      package_canonical: this.packageCanonical,
      packages: this.packages,
      remotes: this.remotes,
    };
  }
}

const loggerDebugMock = vi.fn();
const loggerWarnMock = vi.fn();
const mockLogger = {
  debug: loggerDebugMock,
  warn: loggerWarnMock,
  info: vi.fn(),
  error: vi.fn(),
  // Implement other logger methods if necessary or ensure your code handles their absence
} as any;

describe('Mastra - getMCPServer Versioning Logic', () => {
  const serverIdA = 'logical-server-a';

  const serverA_v1_config: MCPServerConfig = {
    id: serverIdA,
    name: 'Server A v1',
    version: '1.0.0',
    releaseDate: '2023-01-01T00:00:00Z',
    tools: {},
  };
  const serverA_v2_config: MCPServerConfig = {
    id: serverIdA,
    name: 'Server A v2',
    version: '2.0.0',
    releaseDate: '2023-02-01T00:00:00Z',
    tools: {},
  };
  const serverA_v3_config_latest: MCPServerConfig = {
    id: serverIdA,
    name: 'Server A v3',
    version: '3.0.0',
    releaseDate: '2023-03-01T00:00:00Z',
    tools: {},
  };
  const serverB_v1_config: MCPServerConfig = {
    id: 'logical-server-b',
    name: 'Server B v1',
    version: '1.0.0',
    releaseDate: '2023-01-15T00:00:00Z',
    tools: {},
  };
  const serverC_invalid_date_config: MCPServerConfig = {
    id: serverIdA,
    name: 'Server A Invalid Date',
    version: '4.0.0',
    releaseDate: 'invalid-date',
    tools: {},
  };

  let serverA_v1: MCPServerBase;
  let serverA_v2: MCPServerBase;
  let serverA_v3_latest: MCPServerBase;
  let serverB_v1: MCPServerBase;
  let serverC_invalid_date: MCPServerBase;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-initialize servers before each test to reset any internal state if necessary
    serverA_v1 = new MockMCPServer(serverA_v1_config);
    serverA_v2 = new MockMCPServer(serverA_v2_config);
    serverA_v3_latest = new MockMCPServer(serverA_v3_config_latest);
    serverB_v1 = new MockMCPServer(serverB_v1_config);
    serverC_invalid_date = new MockMCPServer(serverC_invalid_date_config);
  });

  it('should return undefined if no mcpServers are configured', () => {
    const mastra = new Mastra({ logger: mockLogger });
    expect(mastra.getMCPServer(serverIdA)).toBeUndefined();
  });

  it('should return undefined if the logical serverId is not found', () => {
    const mastra = new Mastra({
      logger: mockLogger,
      mcpServers: {
        instanceKeyForB: serverB_v1, // Only server B is present
      },
    });
    expect(mastra.getMCPServer(serverIdA)).toBeUndefined();
    expect(loggerDebugMock).toHaveBeenCalledWith(`No MCP servers found with logical ID: ${serverIdA}`);
  });

  it('should fetch a specific version when it exists', () => {
    const mastra = new Mastra({
      logger: mockLogger,
      mcpServers: {
        instanceKey1: serverA_v1,
        instanceKey2: serverA_v2,
        instanceKey3: serverA_v3_latest,
      },
    });
    const result = mastra.getMCPServer(serverIdA, '2.0.0');
    expect(result).toBe(serverA_v2);
    expect(result?.version).toBe('2.0.0');
  });

  it('should return undefined when a specific version does not exist for a logical ID', () => {
    const mastra = new Mastra({
      logger: mockLogger,
      mcpServers: {
        instanceKey1: serverA_v1,
        instanceKey3: serverA_v3_latest,
      },
    });
    const result = mastra.getMCPServer(serverIdA, '2.0.0'); // v2.0.0 is missing
    expect(result).toBeUndefined();
    expect(loggerDebugMock).toHaveBeenCalledWith(
      `MCP server with logical ID '${serverIdA}' found, but not version '2.0.0'.`,
    );
  });

  it('should fetch the latest version when no version is specified', () => {
    const mastra = new Mastra({
      logger: mockLogger,
      mcpServers: {
        instanceKey2: serverA_v2, // Older
        instanceKey1: serverA_v1, // Oldest
        instanceKey3: serverA_v3_latest, // Newest
      },
    });
    const result = mastra.getMCPServer(serverIdA);
    expect(result).toBe(serverA_v3_latest);
    expect(result?.version).toBe('3.0.0');
  });

  it('should fetch the correct latest version when order of registration is mixed', () => {
    const mastra = new Mastra({
      logger: mockLogger,
      mcpServers: {
        instanceKey3: serverA_v3_latest,
        instanceKey1: serverA_v1,
        instanceKey2: serverA_v2,
      },
    });
    const result = mastra.getMCPServer(serverIdA);
    expect(result).toBe(serverA_v3_latest);
  });

  it('should return the single available version if only one exists for the logical ID (no version specified)', () => {
    const mastra = new Mastra({
      logger: mockLogger,
      mcpServers: {
        instanceKeyB: serverB_v1, // Only server B
      },
    });
    const result = mastra.getMCPServer('logical-server-b');
    expect(result).toBe(serverB_v1);
    expect(result?.version).toBe('1.0.0');
  });

  it('should return the single available version if only one exists (specific version matching requested)', () => {
    const mastra = new Mastra({
      logger: mockLogger,
      mcpServers: {
        instanceKeyB: serverB_v1,
      },
    });
    const result = mastra.getMCPServer('logical-server-b', '1.0.0');
    expect(result).toBe(serverB_v1);
  });

  it('should handle servers with invalid release dates when fetching latest', () => {
    const mastra = new Mastra({
      logger: mockLogger,
      mcpServers: {
        instanceKeyA1: serverA_v1, // Valid date
        instanceKeyCInvalid: serverC_invalid_date, // Invalid date
        instanceKeyA2: serverA_v2, // Valid date, latest among valid
      },
    });
    const result = mastra.getMCPServer(serverIdA);
    expect(result).toBe(serverA_v2); // Should pick serverA_v2 as latest valid
    expect(loggerWarnMock).not.toHaveBeenCalledWith(expect.stringContaining('Could not determine the latest server'));
  });

  it('should return undefined and warn if all servers for a logical ID have invalid dates when fetching latest', () => {
    const serverA_v5_invalid_too = new MockMCPServer({
      id: serverIdA,
      name: 'Server A Invalid Date 2',
      version: '5.0.0',
      releaseDate: 'another-invalid',
      tools: {},
    });
    const mastra = new Mastra({
      logger: mockLogger,
      mcpServers: {
        instanceKeyCInvalid: serverC_invalid_date,
        instanceKeyA5Invalid: serverA_v5_invalid_too,
      },
    });
    const result = mastra.getMCPServer(serverIdA);
    expect(result).toBeUndefined();
    expect(loggerWarnMock).toHaveBeenCalledWith(
      expect.stringContaining(`Could not determine the latest server for logical ID '${serverIdA}'`),
    );
  });

  it('should return the correct latest version if one server has an invalid date but others are valid', () => {
    const mastra = new Mastra({
      logger: mockLogger,
      mcpServers: {
        instanceKeyA3Latest: serverA_v3_latest, // Valid, latest
        instanceKeyCInvalid: serverC_invalid_date, // Invalid date
        instanceKeyA1: serverA_v1, // Valid, older
      },
    });
    const result = mastra.getMCPServer(serverIdA);
    expect(result).toBe(serverA_v3_latest);
  });
});
