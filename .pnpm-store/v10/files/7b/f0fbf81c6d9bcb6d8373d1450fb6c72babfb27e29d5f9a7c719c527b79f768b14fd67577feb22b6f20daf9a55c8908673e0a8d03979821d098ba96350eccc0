export declare enum LogLevel {
	None = 0,
	Error = 1,
	Warning = 2,
	Info = 3,
	Debug = 4,
	Trace = 5,
}
export declare type LogLevelString = "none" | "error" | "warn" | "info" | "debug" | "trace"
export declare function convertLogLevel(level?: LogLevelString): LogLevel | undefined
interface Options {
	logLevel: LogLevel
	colors?: boolean
	ID?: string
}
export interface LogFunc {
	(level: LogLevel, ...args: any[]): void
}
export declare function fromTYPESCRIPT_PATHS_LOG_LEVEL(): LogLevel | undefined
export declare function createLogger({ logLevel, colors, ID }?: Partial<Options>): LogFunc
export {}
