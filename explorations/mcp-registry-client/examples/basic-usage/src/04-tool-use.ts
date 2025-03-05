/**
 * Example of using the MCP Configuration Client to pass configured tools to llm
 *
 */

import { Agent } from "@mastra/core"
import { openai } from "@ai-sdk/openai"
import { RegistryClient } from "@mcp/registry"
import { McpConfiguration } from "@mastra/mcp-configuration"
import chalk from "chalk"
import * as readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"

const registry = new RegistryClient({
	url: `https://opentools.com/.well-known/mcp.json`,
})

const mcpConfiguration = new McpConfiguration({
	id: "tools-configuration-1",
	registry,
})

const agent = new Agent({
	name: "Example tool use",
	model: openai(`gpt-4o`),
	instructions: `You are a helpful agent`,
})

const toolsets = await mcpConfiguration.getConnectedTools()

let prompt = `Which tools do you have access to?`

const rl = readline.createInterface({ input, output })
while (true) {
	if (!prompt) {
		prompt = await rl.question(chalk.grey("> "))
		console.log(`\n`)
	} else {
		console.log(chalk.yellow(`\n\n${prompt}\n`))
	}

	const { fullStream } = await agent.stream(prompt, { toolsets })
	prompt = ``

	for await (const part of fullStream) {
		switch (part.type) {
			case "error":
				console.error(part.error)
				break
			case "text-delta":
				process.stdout.write(chalk.blue(part.textDelta))
		}
	}
	console.log(`\n\n`)
}
