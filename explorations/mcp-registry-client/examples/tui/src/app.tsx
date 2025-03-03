import React, { useEffect, useState } from "react"
import { Box, Newline, Text, useInput } from "ink"
import { RegistryClient, ServerDefinition } from "@mcp/registry"
import SelectInput from "ink-select-input"
import {
	McpConfiguration,
	type ConfiguredServer,
} from "@mastra/mcp-configuration"
import { Form } from "ink-form"

const registry = new RegistryClient({
	url: `https://opentools.com/.well-known/mcp`,
})

const configuration = new McpConfiguration({
	id: "tui-config",
	registry,
})

type View =
	| "loading"
	| "menu"
	| "browse-servers"
	| "browse-server"
	| "configure-server"
	| "edit-configurations"

export default function App() {
	const [chosenConfigurationType, setChosenConfigurationType] = useState<
		string | null
	>(null)

	const [view, _setView] = useState<View>("loading")
	const [viewHistory, _setViewHistory] = useState<View[]>([])
	const selectView = (view: View) => {
		if (view === "loading") {
			_setViewHistory([...viewHistory, "menu"])
		} else {
			_setViewHistory([...viewHistory, view])
		}
		_setView(view)
	}
	const goBack = () => {
		if (view === "menu") {
			process.exit()
		}
		viewHistory.pop() // remove current
		const last = viewHistory.at(-1) // get previous
		_setViewHistory(viewHistory)
		_setView(last || "menu")
		setChosenConfigurationType(null)
	}
	useInput((_input, key) => {
		if (
			key.escape &&
			(view !== "configure-server" || !chosenConfigurationType)
		) {
			goBack()
		}
	})

	const [registryServers, setRegistryServers] = useState<
		Array<ServerDefinition>
	>([])
	const [configuredServers, setConfiguredServers] = useState<
		Array<ConfiguredServer>
	>([])
	const [browsedServer, setBrowsedServer] = useState<ServerDefinition | null>(
		null
	)

	const refreshConfiguredServerList = () =>
		configuration.list().then((serverConfigs) => {
			setConfiguredServers(serverConfigs)
		})

	useEffect(() => {
		Promise.all([
			refreshConfiguredServerList(),
			(() => {
				if (registryServers.length === 0) {
					registry.listServers().then(async (servers) => {
						setRegistryServers(servers)
					})
				}
			})(),
		]).then(() => {
			selectView("menu")
		})
	}, [])

	const existingConfig = configuredServers.find(
		(c) => c.serverId === browsedServer?.id
	)

	switch (view) {
		case "loading":
			return <Text>loading..</Text>
		case "menu":
			return (
				<>
					<Text>MCP Registry client TUI</Text>
					<SelectInput
						items={[
							configuredServers.length > 0
								? {
										value: "edit-configurations" as const,
										label: `Edit server configurations (${configuredServers.length})`,
								  }
								: null,
							{ value: "browse-servers" as const, label: "Browse MCP servers" },
							{ value: "exit" as const, label: "Exit" },
						].filter((v): v is NonNullable<typeof v> => Boolean(v))}
						onSelect={(item) => {
							if (item.value === "exit") {
								process.exit()
							}
							selectView(item.value)
						}}
					/>
				</>
			)
		case "configure-server": {
			if (!chosenConfigurationType) {
				return (
					<>
						<Text>Which command do you want to configure?</Text>

						<SelectInput
							items={browsedServer?.config?.map((c) => ({
								value: c.command,
								label: c.command,
							}))}
							onSelect={(i) => {
								setChosenConfigurationType(i.value)
							}}
						/>
					</>
				)
			}

			const c = browsedServer?.config?.find(
				(c) => c.command === chosenConfigurationType
			)!
			return (
				<>
					<Text>{browsedServer?.name} configuration</Text>

					<Form
						form={{
							title: browsedServer?.name,
							sections: [
								{
									title: chosenConfigurationType,
									description: `${c.command} ${c.args?.join(` `) || ""}`,
									fields: [
										c?.runtimeArgs
											? {
													name: "Runtime args",
													type: "string",
													initialValue:
														existingConfig?.config?.runtimeArgs?.join(`, `) ||
														undefined,
													description: `${
														c.runtimeArgs.description
													} - default: ${JSON.stringify(
														c.runtimeArgs.default || []
													)} (use comma separated list for multiple)`,
											  }
											: null,
										...Object.entries(c?.env || {})?.map(([k, v]) => ({
											name: k,
											type: "string",
											description: v.description,
											initialValue:
												existingConfig?.config?.env?.[k] || undefined,
										})),
									].filter((i): i is NonNullable<typeof i> => Boolean(i)),
								},
							],
						}}
						onSubmit={async (value) => {
							setChosenConfigurationType(null)
							const env: Record<string, string> = {}
							let runtimeArgs: string[] = []
							for (const [k, v] of Object.entries(value)) {
								if (k === "Runtime args") {
									runtimeArgs = v.split(`, `)
								} else {
									env[k] = v
								}
							}
							if (!runtimeArgs.length && c.runtimeArgs?.default) {
								runtimeArgs = [...c.runtimeArgs.default]
							}
							const config = {
								command: chosenConfigurationType,
								env: Object.keys(env).length > 0 ? env : undefined,
								runtimeArgs: runtimeArgs.length > 0 ? runtimeArgs : undefined,
							}
							if (existingConfig) {
								await configuration.edit({
									server: { id: browsedServer!.id },
									config,
								})
							} else {
								await configuration.add({
									server: browsedServer!,
									config,
								})
							}
							await refreshConfiguredServerList()
							goBack()
						}}
					/>
				</>
			)
		}
		case "browse-server": {
			return (
				<>
					<Box borderStyle="round" flexDirection="column">
						<Text color="green">{browsedServer?.name} MCP Server</Text>
						<Text>License: {browsedServer?.license}</Text>
						<Text>Downloads: {browsedServer?.downloads}</Text>
						<Text color="blue">{browsedServer?.description}</Text>
						{existingConfig ? (
							<Text color="yellow">
								Configuration: {JSON.stringify(existingConfig.config, null, 2)}
							</Text>
						) : null}
					</Box>
					<Newline />
					<SelectInput
						items={[
							{ value: "configure-server" as const, label: "Configure" },
							existingConfig
								? {
										value: "delete-configuration" as const,
										label: "Delete configuration",
								  }
								: null,
							{ value: "go-back" as const, label: "[Back to servers]" },
						].filter((v): v is NonNullable<typeof v> => Boolean(v))}
						onSelect={(item) => {
							if (item.value === "go-back") {
								selectView("browse-servers")
								setBrowsedServer(null)
							} else if (item.value === "delete-configuration") {
								configuration
									.remove(existingConfig?.serverId!)
									.then(async () => {
										await refreshConfiguredServerList()
									})
							} else {
								selectView(item.value)
							}
						}}
					/>
				</>
			)
		}
		case "browse-servers": {
			return (
				<>
					<Text>Browse MCP servers</Text>

					<SelectInput
						limit={Math.max(process.stdout.rows - 10, 10)}
						items={[
							{ value: "go-back", label: "[Back to menu]" },
							...registryServers.map((s) => ({
								label: s.name,
								value: s.id,
							})),
						]}
						onSelect={async (item) => {
							if (item.value === "go-back") {
								selectView("menu")
								setBrowsedServer(null)
								return
							}
							setBrowsedServer(
								await registry.getServerDefinition({
									id: item.value,
								})
							)
							selectView("browse-server")
						}}
					/>
				</>
			)
		}
		case "edit-configurations":
			return (
				<>
					<Text>Configured MCP servers</Text>

					<SelectInput
						limit={Math.max(process.stdout.rows - 10, 10)}
						items={configuredServers.map((s) => ({
							label: s.server.name,
							value: s.server,
							key: s.serverId,
						}))}
						onSelect={(i) => {
							setBrowsedServer(i.value)
							selectView("browse-server")
						}}
					></SelectInput>
				</>
			)
	}
}
