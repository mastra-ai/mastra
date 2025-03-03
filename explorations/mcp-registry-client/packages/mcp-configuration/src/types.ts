export interface ServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface ServerDefinition {
  id: string
  name: string
  description?: string
  config?: ServerConfig[]
  supportsMultipleRuntimeArgs?: boolean
  requiredEnvVars?: string[]
} 