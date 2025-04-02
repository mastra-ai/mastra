import { Workflow, Step } from '@mastra/core/workflows';
import { createBrowserAgentWithMCP, browserAgent } from '../agents';
import { z } from 'zod';

/**
 * A workflow that demonstrates using the browser agent to search for information
 * and create content based on that information.
 */
export const browserWorkflow = new Workflow({
  name: "browser-research-workflow",
  triggerSchema: z.object({
    topic: z.string().describe("リサーチしたいトピック"),
    aspectOne: z.string().optional().describe("調査する観点1"),
    aspectTwo: z.string().optional().describe("調査する観点2"),
    aspectThree: z.string().optional().describe("調査する観点3"),
  }),
});

// Step 1: Basic research
const researchStep = new Step({
  id: 'researchStep',
  execute: async ({ context }) => {
    const topic = context.triggerData.topic;
    
    // 基本的なブラウザエージェントを使用する例
    const result = await browserAgent.generate(
      `以下のトピックについて調査し、関連情報を収集してください：
      
      ${topic || '学童保育 送迎サービス'}`
    );
    return { research: result.text };
  },
});

// Step 2: More detailed research with MCP
const mcpResearchStep = new Step({
  id: 'mcpResearchStep',
  execute: async ({ context }) => {
    const aspectOne = context.triggerData.aspectOne || '利用料金や費用構造';
    const aspectTwo = context.triggerData.aspectTwo || 'サービスの特徴や差別化ポイント';
    const aspectThree = context.triggerData.aspectThree || 'ユーザーのレビューや評判';
    const stepResult = context.getStepResult('researchStep');
    
    // MCPを活用したブラウザエージェントを作成
    const mcpBrowser = await createBrowserAgentWithMCP();
    
    // 前のステップの結果を活用して追加調査
    const additionalResearch = await mcpBrowser.generate(
      `前の調査結果を参考に、さらに詳しく以下の観点から情報を収集してください：
      
      1. ${aspectOne}
      2. ${aspectTwo}
      3. ${aspectThree}
      
      前の調査結果:
      ${stepResult?.research}`
    );
    
    return { 
      research: stepResult?.research,
      additionalResearch: additionalResearch.text
    };
  },
});

// Step 3: Summarize findings
const summaryStep = new Step({
  id: 'summaryStep',
  execute: async ({ context }) => {
    const stepResult = context.getStepResult('mcpResearchStep');
    
    // 最終的なサマリーを生成
    const mcpBrowser = await createBrowserAgentWithMCP();
    const summary = await mcpBrowser.generate(
      `これまでに収集した以下の情報を元に、コンパクトで分かりやすいサマリーを作成してください。
      このサマリーはブログ記事作成のための基礎資料として使用されます。
      
      基本調査結果:
      ${stepResult?.research}
      
      追加調査結果:
      ${stepResult?.additionalResearch}`
    );
    
    return { 
      research: stepResult?.research,
      additionalResearch: stepResult?.additionalResearch,
      summary: summary.text
    };
  },
});

// ワークフローの構成
browserWorkflow
  .step(researchStep)
  .then(mcpResearchStep)
  .then(summaryStep)
  .commit(); 