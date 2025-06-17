/**
 * Demonstration of MCPClient working with complex schemas
 *
 * This example shows how the MCPClient now gracefully handles
 * complex JSON schemas that previously caused failures.
 */

import { MCPClient } from '@mastra/mcp';

async function demonstrateComplexSchemaSupport() {
  console.log('🧪 Demonstrating MCP Client Complex Schema Support');

  // Example: DataForSEO MCP Server Integration
  const mcpClient = new MCPClient({
    servers: {
      dataforseo: {
        command: 'npx',
        args: ['-y', 'dataforseo-mcp-server'],
        env: {
          DATAFORSEO_USERNAME: process.env.DATAFORSEO_API_LOGIN || '',
          DATAFORSEO_PASSWORD: process.env.DATAFORSEO_API_PASSWORD || '',
          ENABLED_MODULES: 'SERP,KEYWORDS_DATA,ONPAGE,DATAFORSEO_LABS',
          DATAFORSEO_FULL_RESPONSE: 'false',
        },
      },
    },
  });

  try {
    // Connect to the MCP server
    console.log('🔌 Connecting to DataForSEO MCP server...');
    await mcpClient.connect();

    // Get available tools
    console.log('🔍 Discovering available tools...');
    const tools = await mcpClient.tools();

    console.log(`✅ Found ${Object.keys(tools).length} tools`);
    console.log('Available tools:', Object.keys(tools));

    // Test a complex tool that previously failed
    const keywordTool = tools['dataforseo_keywords_data_google_ads_search_volume'];

    if (keywordTool) {
      console.log('\\n📊 Testing keyword research tool...');

      const result = await keywordTool.execute({
        keywords: ['SEO services Melbourne', 'Melbourne SEO expert'],
        location_name: 'Melbourne,Victoria,Australia',
        language_name: 'English'
      });

      console.log('✅ Tool execution successful!');
      console.log('Result:', JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mcpClient.disconnect();
  }
}

// Example of how the fix works internally
function demonstrateSchemaFallback() {
  console.log('\\n🔧 How the Schema Fallback Works:');

  console.log(`
1. **Before the Fix:**
   - Complex schema with 'anyOf' → convertJsonSchemaToZod() fails
   - Tool creation fails → No tools available
   - Parameters never reach MCP server

2. **After the Fix:**
   - Complex schema conversion fails → Log warning
   - Fall back to permissive schema: z.object({}).passthrough()
   - Tool creation succeeds → Parameters pass through correctly
   - MCP server receives parameters and works normally

3. **Benefits:**
   ✅ Works with DataForSEO and other complex MCP servers
   ✅ Maintains compatibility with simple servers
   ✅ Better error reporting and debugging
   ✅ No breaking changes
  `);
}

// Run the demonstration
if (require.main === module) {
  demonstrateComplexSchemaSupport()
    .then(() => demonstrateSchemaFallback())
    .catch(console.error);
}

export { demonstrateComplexSchemaSupport, demonstrateSchemaFallback };