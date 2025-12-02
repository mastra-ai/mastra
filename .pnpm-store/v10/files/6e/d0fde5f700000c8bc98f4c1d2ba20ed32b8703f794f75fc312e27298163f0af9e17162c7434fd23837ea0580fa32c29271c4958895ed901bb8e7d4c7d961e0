/**
 * Shared provider registry generation logic
 * Used by both the CLI generation script and runtime refresh
 */
import type { MastraModelGateway, ProviderConfig } from './gateways/base.js';
/**
 * Write a file atomically using the write-to-temp-then-rename pattern.
 * This prevents file corruption when multiple processes write to the same file concurrently.
 *
 * The rename operation is atomic on POSIX systems when source and destination
 * are on the same filesystem.
 *
 * @param filePath - The target file path
 * @param content - The content to write
 * @param encoding - The encoding to use (default: 'utf-8')
 */
export declare function atomicWriteFile(filePath: string, content: string, encoding?: BufferEncoding): Promise<void>;
/**
 * Fetch providers from all gateways with retry logic
 * @param gateways - Array of gateway instances to fetch from
 * @returns Object containing providers and models records
 */
export declare function fetchProvidersFromGateways(gateways: MastraModelGateway[]): Promise<{
    providers: Record<string, ProviderConfig>;
    models: Record<string, string[]>;
}>;
/**
 * Generate TypeScript type definitions content
 * @param models - Record of provider IDs to model arrays
 * @returns Generated TypeScript type definitions as a string
 */
export declare function generateTypesContent(models: Record<string, string[]>): string;
/**
 * Write registry files to disk (JSON and .d.ts)
 * @param jsonPath - Path to write the JSON file
 * @param typesPath - Path to write the .d.ts file
 * @param providers - Provider configurations
 * @param models - Model lists by provider
 */
export declare function writeRegistryFiles(jsonPath: string, typesPath: string, providers: Record<string, ProviderConfig>, models: Record<string, string[]>): Promise<void>;
//# sourceMappingURL=registry-generator.d.ts.map