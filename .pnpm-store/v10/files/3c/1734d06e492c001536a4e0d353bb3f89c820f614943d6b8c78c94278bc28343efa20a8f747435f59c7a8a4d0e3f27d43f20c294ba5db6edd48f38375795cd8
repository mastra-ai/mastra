import ts from "typescript"
import { LogFunc } from "./logger"
export interface Mapping {
	pattern: string
	prefix: string
	suffix: string
	wildcard: boolean
	targets: string[]
}
export interface TsConfigPayload {
	filePath?: string
	compilerOptions: ts.CompilerOptions
	fileNames: string[]
	references?: TsConfigPayload[]
	extends?: string
}
export declare function getTsConfig({
	tsConfigPath,
	log,
	host,
}: {
	tsConfigPath: string
	log?: LogFunc
	host?: ts.ParseConfigHost
}): undefined | TsConfigPayload
export declare function createMappings({
	paths,
	log,
	respectCoreModule,
}: {
	paths: ts.MapLike<string[]>
	log?: LogFunc
	respectCoreModule?: boolean
}): Mapping[]
export declare function isPatternMatch(prefix: string, suffix: string, candidate: string): boolean
export declare function findMatch(moduleName: string, mappings: Mapping[]): Mapping | undefined
export declare function resolveModuleName({
	mappings,
	request,
	importer,
	compilerOptions,
	host,
	falllback,
}: {
	compilerOptions: ts.CompilerOptions
	mappings: Mapping[]
	request: string
	importer: string
	host: ts.ModuleResolutionHost
	falllback?: (moduleName: string) => boolean
}): string | undefined
