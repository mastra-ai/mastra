import { OptionFallback } from "./handler"
import { LogLevelString } from "./logger"
import { TsConfigPayload } from "./paths"
export interface RegisterOptions {
	tsConfigPath?: string | TsConfigPayload | Array<string | TsConfigPayload>
	respectCoreModule?: boolean
	logLevel?: LogLevelString
	colors?: boolean
	loggerID?: string
}
export declare function register({
	tsConfigPath,
	respectCoreModule,
	logLevel,
	colors,
	loggerID,
	falllback,
}?: RegisterOptions & OptionFallback): () => void
