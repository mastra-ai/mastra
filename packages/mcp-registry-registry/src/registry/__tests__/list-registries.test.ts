import { describe, expect, it } from 'vitest';
import { getRegistryListings } from '../list-registries';

// This test uses the actual registry.json file without any mocking
describe('getRegistryListings integration test', () => {
  it('should return all registries when no filters are provided', async () => {
    const result = await getRegistryListings();

    // The actual registry.json has 17 registries
    expect(result.count).toBeGreaterThan(0);
    expect(result.registries.length).toBeGreaterThan(0);
    // Check for some known registries
    expect(result.registries.map((r: any) => r.id)).toContain('mcprun');
    expect(result.registries.map((r: any) => r.id)).toContain('modelcontextprotocol-servers');
  });

  it('should filter registries by id', async () => {
    const result = await getRegistryListings({ id: 'mcprun' });

    expect(result.count).toBe(1);
    expect(result.registries.length).toBe(1);
    expect(result.registries[0].id).toBe('mcprun');
    expect(result.registries[0].name).toBe('MCP Run');
  });

  it('should filter registries by tag', async () => {
    const result = await getRegistryListings({ tag: 'verified' });

    expect(result.count).toBeGreaterThan(0);
    expect(result.registries.length).toBeGreaterThan(0);
    // Check for some known verified registries
    expect(result.registries.map((r: any) => r.id)).toContain('mcprun');
    expect(result.registries.map((r: any) => r.id)).toContain('apitracker');
    // Official is a different tag
    expect(result.registries.map((r: any) => r.id)).not.toContain('modelcontextprotocol-servers');
  });

  it('should filter registries by name search', async () => {
    const result = await getRegistryListings({ name: 'MCP' });

    expect(result.count).toBeGreaterThan(0);
    expect(result.registries.length).toBeGreaterThan(0);
    // Check for registries with MCP in the name
    expect(result.registries.map((r: any) => r.id)).toContain('mcprun');
    expect(result.registries.map((r: any) => r.id)).toContain('mcpso');
    // This registry doesn't have MCP in the name
    expect(result.registries.map((r: any) => r.id)).not.toContain('opentools');
  });

  it('should combine multiple filters', async () => {
    const result = await getRegistryListings({
      tag: 'verified',
      name: 'MCP',
    });

    expect(result.count).toBeGreaterThan(0);
    expect(result.registries.length).toBeGreaterThan(0);
    // Check for registries with MCP in the name and verified tag
    expect(result.registries.map((r: any) => r.id)).toContain('mcprun');
    expect(result.registries.map((r: any) => r.id)).toContain('mcpso');
    // This registry has the verified tag but not MCP in the name
    expect(result.registries.map((r: any) => r.id)).not.toContain('opentools');
  });

  it('should return detailed information when detailed option is true', async () => {
    const result = await getRegistryListings({ id: 'mcprun' }, { detailed: true });

    expect(result.count).toBe(1);
    expect(result.registries[0].id).toBe('mcprun');
    expect(result.registries[0].name).toBe('MCP Run');
    expect(result.registries[0].description).toBe('One platform for vertical AI across your entire organization.');
    expect(result.registries[0].url).toBe('https://www.mcp.run/');
    expect(result.registries[0].servers_url).toBe('https://www.mcp.run/api/servlets');
    expect(result.registries[0].tags).toEqual(['verified']);
  });

  it('should return only basic information when detailed option is false', async () => {
    const result = await getRegistryListings({ id: 'mcprun' }, { detailed: false });

    expect(result.count).toBe(1);
    expect(result.registries[0].id).toBe('mcprun');
    expect(result.registries[0].name).toBe('MCP Run');
    expect(result.registries[0].description).toBe('One platform for vertical AI across your entire organization.');
    expect(result.registries[0].url).toBeUndefined();
    expect(result.registries[0].servers_url).toBeUndefined();
    expect(result.registries[0].tags).toBeUndefined();
    expect(result.registries[0].count).toBeUndefined();
  });

  it('should return empty result when no registries match the criteria', async () => {
    const result = await getRegistryListings({ id: 'non-existent-id' });

    expect(result.count).toBe(0);
    expect(result.registries).toEqual([]);
  });

  it('should handle case insensitive name search', async () => {
    const result = await getRegistryListings({ name: 'mcp' });

    expect(result.count).toBeGreaterThan(0);
    // Should find registries with 'mcp' in the name regardless of case
    expect(result.registries.map((r: any) => r.id)).toContain('mcprun');
    expect(result.registries.map((r: any) => r.id)).toContain('mcpso');
  });
});
