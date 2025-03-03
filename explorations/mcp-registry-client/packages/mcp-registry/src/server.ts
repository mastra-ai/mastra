import { z } from "zod"

export interface Publisher {
	readonly id: string
	readonly name: string
	readonly url?: string
}

export interface RuntimeConfig {
	readonly command: string
	readonly args?: readonly string[]
	readonly env?: Readonly<Record<string, { 
		readonly description: string
		readonly required?: boolean 
	}>>
	readonly runtimeArgs?: {
		readonly description?: string
		readonly default?: readonly string[]
		readonly multiple?: boolean
	}
}

const runtimeConfigSchema = z.object({
	command: z.string(),
	args: z.array(z.string()).optional(),
	env: z.record(z.object({ 
		description: z.string(),
		required: z.boolean().optional()
	})).optional(),
	runtimeArgs: z.array(z.string()).optional()
})

export interface Distribution {
	readonly type: string
	readonly package: string
}

// Type representing just the data structure of a server without methods
export type ServerData = {
	readonly id: string
	readonly name: string
	readonly description: string
	readonly version: string
	readonly publisher: Publisher
	readonly isOfficial?: boolean
	readonly sourceUrl?: string
	readonly distribution?: Distribution
	readonly license?: string
	readonly runtime?: string
	readonly config?: readonly RuntimeConfig[]
	readonly downloads?: number
	readonly createdAt?: string
	readonly updatedAt?: string
	readonly tags?: readonly string[]
	readonly mcpVersion?: string
	readonly capabilities?: {
		readonly resources?: boolean
		readonly tools?: boolean
		readonly prompts?: boolean
	}
	readonly transport?: {
		readonly type: "stdio" | "sse" | "websocket" | "custom"
		readonly stateful?: boolean
		readonly stateScope?: "user" | "session" | "global"
	}
	readonly userAccess?: {
		readonly type: "single" | "multi"
		readonly auth?: "none" | "token" | "oauth2"
	}
	readonly usage?: {
		readonly type: "free" | "subscription" | "pay-per-query" | "attribution-required"
		readonly cost?: {
			readonly amount: number
			readonly currency: string
			readonly unit: "query" | "month" | "year"
		}
		readonly attribution?: {
			readonly required: boolean
			readonly format?: string
			readonly link?: string
		}
		readonly subscription?: {
			readonly service: string
			readonly url: string
		}
	}
}

// The ServerDefinition interface extends ServerData and adds methods
export interface ServerDefinition extends ServerData {
	parseConfig(config: {
		command: string
		env?: Record<string, string>
		runtimeArgs?: string[]
	}): {
		command: string
		env?: Record<string, string>
		runtimeArgs?: string[]
	}
}

export class ServerDefinition implements ServerData {
	constructor(args: ServerData) {
		if (!args.id) throw new Error("Server ID is required")
		if (!args.name) throw new Error("Server name is required")
		if (!args.description) throw new Error("Server description is required")
		if (!args.version) throw new Error("Server version is required")
		if (!args.publisher) throw new Error("Server publisher is required")
		if (!args.runtime) throw new Error("Server runtime is required")

		// Copy all properties from args
		Object.assign(this, args)
	}

	/**
	 * Convert the server definition to a JSON object
	 */
	toJSON(): ServerData {
		// Return a copy of this object, excluding methods
		return { ...this }
	}

	/**
	 * Parse and validate a configuration against this server's schema
	 */
	parseConfig(config: {
		command: string
		env?: Record<string, string>
		runtimeArgs?: string[]
	}) {
		// Find the matching runtime config for the command
		const runtimeConfig = this.config?.find(rc => rc.command === config.command)
		if (!runtimeConfig) {
			throw new Error(`Command "${config.command}" not found in server configuration`)
		}

		// Validate that all provided env variables are defined in the schema first
		if (config.env) {
			for (const key of Object.keys(config.env)) {
				if (!runtimeConfig.env?.[key]) {
					throw new Error(`Environment variable "${key}" not defined in server configuration`)
				}
			}
		}

		// Check for required env vars
		if (runtimeConfig.env) {
			const missingRequired = Object.entries(runtimeConfig.env)
				.filter(([key, def]) => def.required && !config.env?.[key])
				.map(([key]) => key)

			if (missingRequired.length > 0) {
				throw new Error(`Missing required environment variables: ${missingRequired.join(", ")}`)
			}
		}

		// Validate basic structure
		try {
			runtimeConfigSchema.parse({
				command: config.command,
				runtimeArgs: config.runtimeArgs,
				env: config.env && Object.entries(config.env).reduce((acc, [key, value]) => {
					if (runtimeConfig.env?.[key]) {
						acc[key] = { description: runtimeConfig.env[key].description }
					}
					return acc
				}, {} as Record<string, { description: string }>)
			})
		} catch (error) {
			if (error instanceof z.ZodError) {
				throw new Error(`Invalid configuration structure: ${error.errors[0].message}`)
			}
			throw error
		}

		// Validate runtime args if they exist
		if (config.runtimeArgs?.length) {
			if (!runtimeConfig.runtimeArgs) {
				throw new Error("Runtime arguments provided but not supported by server configuration")
			}

			// Check if multiple runtime args are allowed
			if (!runtimeConfig.runtimeArgs.multiple && config.runtimeArgs.length > 1) {
				throw new Error("Multiple runtime arguments provided but not supported by server configuration")
			}
		}

		return config
	}
}
