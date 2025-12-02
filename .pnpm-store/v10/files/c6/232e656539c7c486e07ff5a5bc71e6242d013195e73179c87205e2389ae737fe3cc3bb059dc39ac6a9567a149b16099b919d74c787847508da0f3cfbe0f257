import { LogFunc } from "./logger"
import { TsConfigPayload } from "./paths"
export interface OptionFallback {
	falllback?: (moduleName: string) => boolean
}
export interface HandlerOptions {
	/** Specifies the path to tsconfig.json */
	tsConfigPath?: string | TsConfigPayload | Array<string | TsConfigPayload>
	/** The directory where the tsconfig is stored */
	searchPath?: string | string[]
	respectCoreModule?: boolean
	log?: LogFunc
}
export declare function fromTS_NODE_PROJECT(): string[] | undefined
export declare function createHandler({
	searchPath,
	tsConfigPath,
	respectCoreModule,
	log,
	falllback,
}?: HandlerOptions & OptionFallback): ((request: string, importer: string) => string | undefined) | undefined
