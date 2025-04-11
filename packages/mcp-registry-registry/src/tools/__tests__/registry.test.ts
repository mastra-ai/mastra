import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import { registryTool } from '../registry';

// Mock the fs module
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

// Mock the fromPackageRoot function
vi.mock('../../utils', () => ({
  fromPackageRoot: vi.fn(() => 'mocked-path'),
}));

describe('registry tool', () => {
  const mockRegistryData = {
    registries: [
      {
        id: 'modelcontextprotocol-servers',
        name: 'modelcontextprotocol/servers',
        description:
          'This repository is a collection of reference implementations for the Model Context Protocol (MCP).',
        url: 'https://github.com/modelcontextprotocol/servers',
        tags: ['official'],
        count: 307,
      },
      {
        id: 'awesome-mcp-servers',
        name: 'Awesome MCP servers',
        description: 'A curated list of awesome Model Context Protocol (MCP) servers.',
        url: 'https://github.com/punkpeye/awesome-mcp-servers',
        tags: ['open-source'],
        count: 370,
      },
      {
        id: 'mcp-market',
        name: 'MCP Market',
        description: 'Explore our curated collection of MCP servers to connect AI to your favorite tools.',
        url: 'https://mcpmarket.com/',
        count: 12454,
      },
      {
        id: 'pulse-mcp',
        name: 'Pulse MCP',
        description: 'Browse and discover MCP use cases, servers, clients, and news.',
        url: 'https://www.pulsemcp.com/',
        tags: ['verified'],
        count: 3653,
      },
    ],
  };

  beforeEach(() => {
    // Setup mock for fs.readFile
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRegistryData));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return all registries when no filters are provided', async () => {
    const result = await registryTool.execute({});

    expect(result.content[0].text).toContain('Found 4 registries');
    expect(result.content[0].text).toContain('modelcontextprotocol/servers');
    expect(result.content[0].text).toContain('Awesome MCP servers');
    expect(result.content[0].text).toContain('MCP Market');
    expect(result.content[0].text).toContain('Pulse MCP');
  });

  it('should filter registries by id', async () => {
    const result = await registryTool.execute({ id: 'mcp-market' });

    expect(result.content[0].text).toContain('Registry: MCP Market (mcp-market)');
    expect(result.content[0].text).toContain('Count: 12454');
    expect(result.content[0].text).not.toContain('Tags:');
  });

  it('should filter registries by tag', async () => {
    const result = await registryTool.execute({ tag: 'verified' });

    // When there's only one result, it returns detailed info instead of a list
    expect(result.content[0].text).toContain('Registry: Pulse MCP');
    expect(result.content[0].text).toContain('Tags: verified');
    expect(result.content[0].text).toContain('Count: 3653');
    expect(result.content[0].text).not.toContain('modelcontextprotocol/servers');
  });

  it('should filter registries by name search', async () => {
    const result = await registryTool.execute({ name: 'awesome' });

    expect(result.content[0].text).toContain('Registry: Awesome MCP servers');
    expect(result.content[0].text).toContain('Tags: open-source');
    expect(result.content[0].text).toContain('Count: 370');
  });

  it('should combine multiple filters', async () => {
    const result = await registryTool.execute({
      tag: 'open-source',
      name: 'awesome',
    });

    expect(result.content[0].text).toContain('Registry: Awesome MCP servers');
    expect(result.content[0].text).toContain('Tags: open-source');
    expect(result.content[0].text).not.toContain('MCP Market');
  });

  it('should return a message when no registries match the criteria', async () => {
    const result = await registryTool.execute({ id: 'non-existent-id' });

    expect(result.content[0].text).toBe('No registries found matching the provided criteria.');
  });

  it('should handle case insensitive name search', async () => {
    const result = await registryTool.execute({ name: 'AWESOME' });

    expect(result.content[0].text).toContain('Registry: Awesome MCP servers');
  });

  it('should handle error when registry file cannot be loaded', async () => {
    // Setup mock to throw an error
    vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('File not found'));

    const result = await registryTool.execute({});

    expect(result.content[0].text).toBe('No registries found matching the provided criteria.');
  });
});
