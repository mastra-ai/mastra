/**
 * Proof of Concept: WorkflowExecutionEngine
 * 
 * This demonstrates code generation from Mastra's execution graph
 * for execution through Workflow's runtime.
 * 
 * LIMITATIONS:
 * - Only supports sequential and parallel steps
 * - No support for conditional (branch) with runtime closures
 * - No support for loops (dountil/dowhile) with runtime closures
 */

import { ExecutionEngine } from '@mastra/core/workflows';
import type { ExecutionGraph, StepFlowEntry, StepResult } from '@mastra/core/workflows';

/**
 * Generates workflow code from Mastra's execution graph
 */
export class CodeGenerator {
  generate(graph: ExecutionGraph, workflowId: string): string {
    this.validate(graph);
    
    const lines: string[] = [];
    lines.push(`export async function mastra_${workflowId}(input) {`);
    
    let lastVar = 'input';
    let varCounter = 0;
    
    for (const entry of graph.steps) {
      const result = this.generateEntry(entry, lastVar, varCounter);
      lines.push(...result.lines);
      lastVar = result.outputVar;
      varCounter = result.nextCounter;
    }
    
    lines.push(`  return ${lastVar};`);
    lines.push(`}`);
    
    return lines.join('\n');
  }
  
  private generateEntry(
    entry: StepFlowEntry,
    inputVar: string,
    counter: number,
  ): { lines: string[]; outputVar: string; nextCounter: number } {
    const lines: string[] = [];
    
    if (entry.type === 'step') {
      const outputVar = `r_${counter}`;
      lines.push(
        `  const ${outputVar} = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]` +
        `("${entry.step.id}")(${inputVar});`
      );
      return { lines, outputVar, nextCounter: counter + 1 };
    }
    
    if (entry.type === 'parallel') {
      const stepVars = entry.steps.map((_, i) => `r_${counter}_${i}`);
      const calls = entry.steps.map((step, i) => {
        if (step.type === 'step') {
          return `    globalThis[Symbol.for("WORKFLOW_USE_STEP")]("${step.step.id}")(${inputVar})`;
        }
        throw new Error(`Unsupported parallel entry type: ${step.type}`);
      });
      
      lines.push(`  const [${stepVars.join(', ')}] = await Promise.all([`);
      lines.push(calls.join(',\n') + ',');
      lines.push(`  ]);`);
      
      // Create result object with step IDs as keys
      const outputVar = `r_${counter}`;
      const resultObj = entry.steps
        .map((step, i) => {
          if (step.type === 'step') {
            return `"${step.step.id}": ${stepVars[i]}`;
          }
          return '';
        })
        .filter(Boolean)
        .join(', ');
      lines.push(`  const ${outputVar} = { ${resultObj} };`);
      
      return { lines, outputVar, nextCounter: counter + 1 };
    }
    
    if (entry.type === 'foreach') {
      // Generate foreach as map with concurrency
      const outputVar = `r_${counter}`;
      const tempVar = `items_${counter}`;
      const { concurrency } = entry.opts;
      
      lines.push(`  const ${tempVar} = ${inputVar};`);
      lines.push(`  const ${outputVar} = [];`);
      lines.push(`  for (let i = 0; i < ${tempVar}.length; i += ${concurrency}) {`);
      lines.push(`    const batch = ${tempVar}.slice(i, i + ${concurrency});`);
      lines.push(`    const results = await Promise.all(batch.map(item =>`);
      lines.push(`      globalThis[Symbol.for("WORKFLOW_USE_STEP")]("${entry.step.id}")(item)`);
      lines.push(`    ));`);
      lines.push(`    ${outputVar}.push(...results);`);
      lines.push(`  }`);
      
      return { lines, outputVar, nextCounter: counter + 1 };
    }
    
    if (entry.type === 'sleep') {
      if (entry.fn) {
        throw new Error('Dynamic sleep (with function) is not supported by WorkflowExecutionEngine');
      }
      const outputVar = `r_${counter}`;
      const duration = entry.duration || 0;
      lines.push(`  await new Promise(resolve => setTimeout(resolve, ${duration}));`);
      lines.push(`  const ${outputVar} = ${inputVar};`);
      return { lines, outputVar, nextCounter: counter + 1 };
    }
    
    throw new Error(`Unsupported entry type: ${entry.type}`);
  }
  
  private validate(graph: ExecutionGraph) {
    for (const entry of graph.steps) {
      this.validateEntry(entry);
    }
  }
  
  private validateEntry(entry: StepFlowEntry) {
    if (entry.type === 'conditional') {
      throw new Error(
        'WorkflowExecutionEngine does not support .branch() with runtime closures.\n' +
        'Conditional logic requires JavaScript functions that cannot be serialized to code strings.\n' +
        'Options:\n' +
        '  1. Use DefaultExecutionEngine for full Mastra features\n' +
        '  2. Rewrite using static branches (see docs)\n' +
        '  3. Write native Workflow code instead'
      );
    }
    
    if (entry.type === 'loop') {
      throw new Error(
        'WorkflowExecutionEngine does not support .dountil()/.dowhile() with runtime closures.\n' +
        'Loop conditions require JavaScript functions that cannot be serialized to code strings.\n' +
        'Options:\n' +
        '  1. Use DefaultExecutionEngine for full Mastra features\n' +
        '  2. Unroll loops into sequential steps\n' +
        '  3. Write native Workflow code instead'
      );
    }
    
    if (entry.type === 'sleep' && entry.fn) {
      throw new Error(
        'WorkflowExecutionEngine does not support dynamic sleep with functions.\n' +
        'Use static sleep duration: .sleep(1000) instead of .sleep(() => duration)'
      );
    }
    
    if (entry.type === 'sleepUntil' && entry.fn) {
      throw new Error(
        'WorkflowExecutionEngine does not support dynamic sleepUntil with functions.\n' +
        'Use static date: .sleepUntil(new Date("2024-12-31")) instead of .sleepUntil(() => date)'
      );
    }
    
    if (entry.type === 'parallel') {
      for (const step of entry.steps) {
        this.validateEntry(step);
      }
    }
  }
}

/**
 * Example generated code output
 */
export const EXAMPLE_GENERATED_CODE = `
// Input: Mastra workflow with sequential and parallel steps
createWorkflow({...})
  .then(step1)
  .then(step2)
  .parallel([step3, step4, step5])
  .then(step6)
  .commit()

// Generated Output:
export async function mastra_my_workflow(input) {
  const r_0 = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step1")(input);
  const r_1 = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step2")(r_0);
  const [r_2_0, r_2_1, r_2_2] = await Promise.all([
    globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step3")(r_1),
    globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step4")(r_1),
    globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step5")(r_1),
  ]);
  const r_2 = { "step3": r_2_0, "step4": r_2_1, "step5": r_2_2 };
  const r_3 = await globalThis[Symbol.for("WORKFLOW_USE_STEP")]("step6")(r_2);
  return r_3;
}

// Then executed through Workflow's VM runtime with event log durability
`;

/**
 * Execution engine implementation (incomplete - needs Workflow runtime integration)
 */
export class WorkflowExecutionEngine extends ExecutionEngine {
  private generator = new CodeGenerator();
  
  async execute<TState, TInput, TOutput>(params: {
    workflowId: string;
    runId: string;
    graph: ExecutionGraph;
    input?: TInput;
    // ... other Mastra params
  }): Promise<TOutput> {
    const { graph, input, workflowId } = params;
    
    // Step 1: Generate JavaScript code from execution graph
    const code = this.generator.generate(graph, workflowId);
    
    console.log('Generated code:', code);
    
    // Step 2: Register Mastra steps as Workflow step functions
    // This would call registerStepFunction() from @workflow/core/private
    // for each step in the graph, mapping them to Mastra step.execute()
    
    // Step 3: Execute through Workflow runtime
    // This would call runWorkflow() from @workflow/core/workflow
    // passing the generated code string and input
    
    // Step 4: Map Workflow's result back to Mastra's result format
    
    throw new Error('Not yet implemented - requires Workflow runtime integration');
  }
}

/**
 * Usage example showing what works and what doesn't
 */
export const USAGE_EXAMPLES = `
import { createWorkflow, createStep } from '@mastra/workflows';
import { WorkflowExecutionEngine } from '@mastra/workflow-engine';

// ✅ WORKS: Sequential steps
const workflowSeq = createWorkflow({
  id: 'sequential',
  executionEngine: new WorkflowExecutionEngine({...}),
})
  .then(step1)
  .then(step2)
  .then(step3)
  .commit();

// ✅ WORKS: Parallel steps  
const workflowPar = createWorkflow({
  id: 'parallel',
  executionEngine: new WorkflowExecutionEngine({...}),
})
  .then(fetchData)
  .parallel([processA, processB, processC])
  .then(combine)
  .commit();

// ✅ WORKS: Foreach with static concurrency
const workflowForeach = createWorkflow({
  id: 'foreach',
  executionEngine: new WorkflowExecutionEngine({...}),
})
  .then(getItems)
  .foreach(processItem, { concurrency: 3 })
  .commit();

// ✅ WORKS: Static sleep
const workflowSleep = createWorkflow({
  id: 'sleep',
  executionEngine: new WorkflowExecutionEngine({...}),
})
  .then(step1)
  .sleep(5000)
  .then(step2)
  .commit();

// ❌ DOESN'T WORK: Conditional with runtime closure
const workflowBranch = createWorkflow({
  id: 'branch',
  executionEngine: new WorkflowExecutionEngine({...}),
})
  .then(checkScore)
  .branch([
    // ERROR: Cannot serialize this function to code string
    [async ({ inputData }) => inputData.score > 80, highStep],
    [async () => true, lowStep],
  ])
  .commit();

// ❌ DOESN'T WORK: Loop with runtime condition
const workflowLoop = createWorkflow({
  id: 'loop',
  executionEngine: new WorkflowExecutionEngine({...}),
})
  .dountil(
    incrementStep,
    // ERROR: Cannot serialize this function to code string
    async ({ inputData }) => inputData.value >= 10
  )
  .commit();

// ❌ DOESN'T WORK: Dynamic sleep
const workflowDynSleep = createWorkflow({
  id: 'dynamic-sleep',
  executionEngine: new WorkflowExecutionEngine({...}),
})
  .sleep(
    // ERROR: Cannot serialize this function to code string
    async ({ inputData }) => inputData.delayMs
  )
  .commit();
`;
