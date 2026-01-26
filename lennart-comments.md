mfrachet
commented
7 hours ago
We already have MASTRA_STUDIO_BASE_PATH for this purpose at the server level IIRC cc @LekoArts

LekoArts
LekoArts requested changes 6 hours ago
.changeset/yellow-clubs-train.md
Member
@LekoArts
LekoArts
6 hours ago
When we're ready to publish these changesets need to be separated out into individual ones

@NikAiyer	Reply...
client-sdks/client-js/src/resources/base.ts
 * @param prefix - The prefix to normalize
 * @returns Normalized prefix (e.g., '/api', '/mastra')
 */
function normalizePrefix(prefix: string): string {
Member
@LekoArts
LekoArts
6 hours ago
Take a look at

mastra/packages/deployer/src/build/utils.ts

Lines 151 to 187 in e6d344e

 /** 
  * Ensures that server.studioBase is normalized. 
  * 
  * - If server.studioBase is '/' or empty, returns empty string 
  * - Normalizes multiple slashes to single slash (e.g., '//' → '/') 
  * - Removes trailing slashes (e.g., '/admin/' → '/admin') 
  * - Adds leading slash if missing (e.g., 'admin' → '/admin') 
  * 
  * @param studioBase - The studioBase path to normalize 
  * @returns Normalized studioBase path string 
  */ 
 export function normalizeStudioBase(studioBase: string): string { 
   // Validate: no path traversal, no query params, no special chars 
   if (studioBase.includes('..') || studioBase.includes('?') || studioBase.includes('#')) { 
     throw new Error(`Invalid base path: "${studioBase}". Base path cannot contain '..', '?', or '#'`); 
   } 
  
   // Normalize multiple slashes to single slash 
   studioBase = studioBase.replace(/\/+/g, '/'); 
  
   // Handle default value cases 
   if (studioBase === '/' || studioBase === '') { 
     return ''; 
   } 
  
   // Remove trailing slash 
   if (studioBase.endsWith('/')) { 
     studioBase = studioBase.slice(0, -1); 
   } 
  
   // Add leading slash if missing 
   if (!studioBase.startsWith('/')) { 
     studioBase = `/${studioBase}`; 
   } 
  
   return studioBase; 
 } 
, this handles everything including path traversal attempts
@NikAiyer	Reply...
client-sdks/client-js/src/types.ts
  /** Base URL for API requests */
  baseUrl: string;
  /** API route prefix. Defaults to '/api'. Set this to match your server's prefix configuration. */
  prefix?: string;
Member
@LekoArts
LekoArts
6 hours ago
apiPrefix as an option would make it clearer. Since we also have studioBase it could be confusing if we just have prefix

@NikAiyer	Reply...
packages/cli/src/index.ts
  .option('-h, --server-host <serverHost>', 'Host of the Mastra API server (default: localhost)')
  .option('-s, --server-port <serverPort>', 'Port of the Mastra API server (default: 4111)')
  .option('-x, --server-protocol <serverProtocol>', 'Protocol of the Mastra API server (default: http)')
  .option('--server-prefix <serverPrefix>', 'API route prefix of the Mastra server (default: /api)')
Member
@LekoArts
LekoArts
6 hours ago
Why not --api-prefix?

@NikAiyer	Reply...
packages/server/src/server/server-adapter/index.ts
 * @param prefix - The prefix to normalize (e.g., 'mastra', '/mastra/', '/mastra')
 * @returns Normalized prefix with leading slash and no trailing slash (e.g., '/mastra')
 */
function normalizePrefix(prefix: string): string {
Member
@LekoArts
LekoArts
6 hours ago
Since we use

mastra/packages/deployer/src/build/utils.ts

Lines 151 to 187 in e6d344e

 /** 
  * Ensures that server.studioBase is normalized. 
  * 
  * - If server.studioBase is '/' or empty, returns empty string 
  * - Normalizes multiple slashes to single slash (e.g., '//' → '/') 
  * - Removes trailing slashes (e.g., '/admin/' → '/admin') 
  * - Adds leading slash if missing (e.g., 'admin' → '/admin') 
  * 
  * @param studioBase - The studioBase path to normalize 
  * @returns Normalized studioBase path string 
  */ 
 export function normalizeStudioBase(studioBase: string): string { 
   // Validate: no path traversal, no query params, no special chars 
   if (studioBase.includes('..') || studioBase.includes('?') || studioBase.includes('#')) { 
     throw new Error(`Invalid base path: "${studioBase}". Base path cannot contain '..', '?', or '#'`); 
   } 
  
   // Normalize multiple slashes to single slash 
   studioBase = studioBase.replace(/\/+/g, '/'); 
  
   // Handle default value cases 
   if (studioBase === '/' || studioBase === '') { 
     return ''; 
   } 
  
   // Remove trailing slash 
   if (studioBase.endsWith('/')) { 
     studioBase = studioBase.slice(0, -1); 
   } 
  
   // Add leading slash if missing 
   if (!studioBase.startsWith('/')) { 
     studioBase = `/${studioBase}`; 
   } 
  
   return studioBase; 
 } 
again here and all three packages use @mastra/core it would be worth it to move
mastra/packages/deployer/src/build/utils.ts

Lines 151 to 187 in e6d344e

 /** 
  * Ensures that server.studioBase is normalized. 
  * 
  * - If server.studioBase is '/' or empty, returns empty string 
  * - Normalizes multiple slashes to single slash (e.g., '//' → '/') 
  * - Removes trailing slashes (e.g., '/admin/' → '/admin') 
  * - Adds leading slash if missing (e.g., 'admin' → '/admin') 
  * 
  * @param studioBase - The studioBase path to normalize 
  * @returns Normalized studioBase path string 
  */ 
 export function normalizeStudioBase(studioBase: string): string { 
   // Validate: no path traversal, no query params, no special chars 
   if (studioBase.includes('..') || studioBase.includes('?') || studioBase.includes('#')) { 
     throw new Error(`Invalid base path: "${studioBase}". Base path cannot contain '..', '?', or '#'`); 
   } 
  
   // Normalize multiple slashes to single slash 
   studioBase = studioBase.replace(/\/+/g, '/'); 
  
   // Handle default value cases 
   if (studioBase === '/' || studioBase === '') { 
     return ''; 
   } 
  
   // Remove trailing slash 
   if (studioBase.endsWith('/')) { 
     studioBase = studioBase.slice(0, -1); 
   } 
  
   // Add leading slash if missing 
   if (!studioBase.startsWith('/')) { 
     studioBase = `/${studioBase}`; 
   } 
  
   return studioBase; 
 } 
to @mastra/core and reuse from there
