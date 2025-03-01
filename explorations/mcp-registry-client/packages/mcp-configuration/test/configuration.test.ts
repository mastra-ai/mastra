import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { McpConfiguration } from '../src/index.js'
import { RegistryClient, ServerDefinition } from '@mcp/registry'
import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

vi.mock('fs', () => ({
  existsSync: vi.fn()
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn()
}))

describe('McpConfiguration', () => {
  const registry = new RegistryClient({
    url: 'https://opentools.com/.well-known/mcp'
  })

  let config: McpConfiguration

  beforeEach(() => {
    vi.clearAllMocks()
    config = new McpConfiguration({
      id: 'test-config',
      registry
    })
    ;(existsSync as any).mockReturnValue(false)
    ;(readFile as any).mockResolvedValue('{"configurations": {}}')
    ;(writeFile as any).mockResolvedValue(undefined)
  })

  describe('constructor', () => {
    it('should initialize with required fields', () => {
      expect(config.registry).toBe(registry)
      expect(config['id']).toBe('test-config')
      expect(config['configPath']).toBe(join(process.cwd(), '.mcp-config.json'))
    })

    it('should accept optional headers', () => {
      const headers = { 'X-Custom': 'value' }
      const configWithHeaders = new McpConfiguration({
        id: 'test',
        registry,
        headers
      })
      expect(configWithHeaders['headers']).toEqual(headers)
    })
  })

  describe('add', () => {
    let stripeServer: ServerDefinition

    beforeEach(async () => {
      stripeServer = await registry.getServerDefinition({ id: 'stripe' })
    })

    it('should add valid configuration', async () => {
      const validConfig = {
        command: 'npx',
        args: ['-y', '@stripe/mcp', '--tools=all'],
        env: { 'STRIPE_API_KEY': 'test_key' }
      }

      const result = await config.add({
        server: stripeServer,
        config: validConfig
      })

      expect(result).toBeDefined()
      expect(result.serverId).toBe(stripeServer.id)
      expect(result.config).toEqual(validConfig)
      expect(writeFile).toHaveBeenCalled()

      // Verify timestamps
      expect(result.createdAt).toBeDefined()
      expect(result.updatedAt).toBe(result.createdAt)
      
      // Verify persistence
      const stored = await config.get(stripeServer.id)
      expect(stored?.config).toEqual(validConfig)
    })

    it('should throw for invalid configuration', async () => {
      const invalidConfig = {
        command: 'invalid-cmd'
      }

      await expect(config.add({
        server: stripeServer,
        config: invalidConfig
      })).rejects.toThrow('Command "invalid-cmd" not found in server configuration')
    })

    it('should validate runtime arguments', async () => {
      // Get a server with runtime args validation
      const everythingServer = await registry.getServerDefinition({ id: 'everything-ref' })
      
      // Should fail with multiple args when not allowed
      await expect(config.add({
        server: everythingServer,
        config: {
          command: 'npx',
          runtimeArgs: ['dir1', 'dir2']
        }
      })).rejects.toThrow('Multiple runtime arguments provided but not supported')

      // Should succeed with single runtime arg
      const result = await config.add({
        server: everythingServer,
        config: {
          command: 'npx',
          runtimeArgs: ['test-dir']
        }
      })
      expect(result).toBeDefined()
    })

    it('should validate required environment variables', async () => {
      // Should fail without required env var
      await expect(config.add({
        server: stripeServer,
        config: {
          command: 'npx'
        }
      })).rejects.toThrow('Missing required environment variables: STRIPE_API_KEY')

      // Should succeed with required env var
      const result = await config.add({
        server: stripeServer,
        config: {
          command: 'npx',
          env: { 'STRIPE_API_KEY': 'test_key' }
        }
      })
      expect(result).toBeDefined()
    })

    it('should not allow duplicate configurations for the same server', async () => {
      // Add first config
      await config.add({
        server: stripeServer,
        config: {
          command: 'npx',
          env: { 'STRIPE_API_KEY': 'test_key' }
        }
      })

      // Try to add second config for same server
      await expect(config.add({
        server: stripeServer,
        config: {
          command: 'npx',
          env: { 'STRIPE_API_KEY': 'another_key' }
        }
      })).rejects.toThrow(/already exists/)
    })
  })

  describe('edit', () => {
    let stripeServer: ServerDefinition

    beforeEach(async () => {
      stripeServer = await registry.getServerDefinition({ id: 'stripe' })
      // Add initial configuration
      await config.add({
        server: stripeServer,
        config: {
          command: 'npx',
          args: ['-y', '@stripe/mcp', '--tools=all'],
          env: { 'STRIPE_API_KEY': 'initial' }
        }
      })
    })

    it('should edit existing configuration', async () => {
      const updatedConfig = {
        command: 'npx',
        args: ['-y', '@stripe/mcp', '--tools=all'],
        env: { 'STRIPE_API_KEY': 'updated' }
      }

      const result = await config.edit({
        server: { id: stripeServer.id },
        config: updatedConfig
      })

      expect(result.config).toEqual(updatedConfig)
      
      // Verify persistence
      const stored = await config.get(stripeServer.id)
      expect(stored?.config).toEqual(updatedConfig)
    })

    it('should update timestamps on edit', async () => {
      const before = await config.get(stripeServer.id)
      await new Promise(resolve => setTimeout(resolve, 10)) // Ensure time difference
      
      const result = await config.edit({
        server: { id: stripeServer.id },
        config: {
          command: 'npx',
          env: { 'STRIPE_API_KEY': 'new-value' }
        }
      })

      expect(result.createdAt).toBe(before?.createdAt)
      expect(result.updatedAt).not.toBe(before?.updatedAt)
      expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(new Date(before!.updatedAt).getTime())
    })

    it('should validate runtime arguments', async () => {
      // Get a server with runtime args validation
      const everythingServer = await registry.getServerDefinition({ id: 'everything-ref' })
      await config.add({
        server: everythingServer,
        config: {
          command: 'npx',
          runtimeArgs: ['test-dir']
        }
      })

      // Should fail when multiple args provided but not allowed
      await expect(config.edit({
        server: { id: everythingServer.id },
        config: {
          command: 'npx',
          runtimeArgs: ['dir1', 'dir2']
        }
      })).rejects.toThrow('Multiple runtime arguments provided but not supported')
    })

    it('should validate environment variables', async () => {
      await expect(config.edit({
        server: { id: stripeServer.id },
        config: {
          command: 'npx',
          env: { 'INVALID_KEY': 'value' }
        }
      })).rejects.toThrow('Environment variable "INVALID_KEY" not defined in server configuration')
    })

    it('should throw for non-existent server', async () => {
      await expect(config.edit({
        server: { id: 'non-existent' },
        config: { command: 'test-cmd' }
      })).rejects.toThrow('RegistryClient: Server "non-existent" not found in registry at')
    })
  })

  describe('remove', () => {
    let stripeServer: ServerDefinition

    beforeEach(async () => {
      stripeServer = await registry.getServerDefinition({ id: 'stripe' })
      await config.add({
        server: stripeServer,
        config: {
          command: 'npx',
          args: ['-y', '@stripe/mcp', '--tools=all'],
          env: { 'STRIPE_API_KEY': 'value' }
        }
      })
    })

    it('should remove existing configuration', async () => {
      const removed = await config.remove(stripeServer.id)
      expect(removed.serverId).toBe(stripeServer.id)
      const stored = await config.get(stripeServer.id)
      expect(stored).toBeNull()
    })

    it('should throw for non-existent server', async () => {
      await expect(config.remove('non-existent')).rejects.toThrow('Configuration for server non-existent not found')
    })
  })

  describe('list', () => {
    let stripeServer: ServerDefinition

    beforeEach(async () => {
      stripeServer = await registry.getServerDefinition({ id: 'stripe' })
      await config.add({
        server: stripeServer,
        config: {
          command: 'npx',
          args: ['-y', '@stripe/mcp', '--tools=all'],
          env: { 'STRIPE_API_KEY': 'value' }
        }
      })
    })

    it('should list all configurations with server details', async () => {
      const list = await config.list()
      expect(list).toHaveLength(1)
      expect(list[0].serverId).toBe(stripeServer.id)
      expect(list[0].server).toBeInstanceOf(ServerDefinition)
      expect(list[0].config.command).toBe('npx')
    })

    it('should return empty array when no configurations exist', async () => {
      await config.remove(stripeServer.id)
      const list = await config.list()
      expect(list).toHaveLength(0)
    })
  })
}) 