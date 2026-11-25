import path from 'path'
import { fileURLToPath } from 'url'

export const DOCS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const SPEC_URL = 'https://gateway-api.mastra.ai/openapi.json'
export const API_HOST = 'https://gateway-api.mastra.ai'
/** Where the transformed spec is written. Read by the plugin config in docusaurus.config.ts. */
export const SPEC_OUTPUT = '.generated/gateway-api/openapi.json'
/** Where the plugin writes the pages. Hand-written guides live next to them in `_guides/`. */
export const PAGES_DIR = 'src/content/en/docs/mastra-platform/gateway/api'
export const PLUGIN_ID = 'gateway'
