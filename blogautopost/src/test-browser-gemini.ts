import { browserAgent, createBrowserAgentWithMCP } from './mastra';

async function testBrowserAgent() {
  console.log("Testing Browser Agent with Gemini...");
  
  try {
    // Test the standard browser agent
    const result = await browserAgent.generate(
      "「アイドル」に関連する情報を収集してください。特に日本のアイドルグループや最近のトレンドについて調べてください。"
    );
    
    console.log("===== Standard Browser Agent Result =====");
    console.log(result.text);
    console.log("========================================");

    // Test the MCP-enabled browser agent
    console.log("\nTesting Browser Agent with MCP...");
    const mcpBrowser = await createBrowserAgentWithMCP();
    
    const mcpResult = await mcpBrowser.generate(
      "「学童保育」について、特に保護者が気にする点や民間学童のメリットについて情報を収集してください。"
    );
    
    console.log("===== MCP Browser Agent Result =====");
    console.log(mcpResult.text);
    console.log("====================================");
    
  } catch (error) {
    console.error("Error testing browser agent:", error);
  }
}

// Run the test
testBrowserAgent().catch(console.error); 