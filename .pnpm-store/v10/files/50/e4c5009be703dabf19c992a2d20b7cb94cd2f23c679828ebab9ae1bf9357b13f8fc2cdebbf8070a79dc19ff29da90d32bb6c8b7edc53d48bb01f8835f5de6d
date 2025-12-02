import { fileURLToPath, pathToFileURL } from "url"
import { createHandler, createLogger, LogLevel } from "./index.js"

const log = createLogger()
const handler = createHandler({ log })

/**
 * @param {import("url").URL} specifier
 * @param {{parentURL?: import("url").URL | null | undefined; conditions: string[]}} context
 */
export function resolve(specifier, context, defaultResolve) {
	const { parentURL = null } = context
	if (!handler || !parentURL) return defaultResolve(specifier, context, defaultResolve)

	const importer = fileURLToPath(parentURL)
	const moduleName = handler(specifier, importer)
	if (moduleName) {
		log(LogLevel.Debug, `${specifier} -> ${moduleName}`)
		specifier = new URL(pathToFileURL(moduleName))
	}

	return defaultResolve(specifier, context, defaultResolve)
}
