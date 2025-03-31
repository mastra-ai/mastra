import { mastra } from './mastra';
import { processDataStream } from '@ai-sdk/ui-utils';

async function main() {
  const wflow = mastra.getWorkflow('agentWorkflow');

  const { stream } = wflow.createRun();

  const result = await stream({
    triggerData: {
      prompt: 'What is the capital of France?',
    },
  });

  await processDataStream({
    stream: result,
    onTextPart: text => {
      console.log(text);
    },
    onReasoningPart: reasoning => {
      console.log(reasoning);
    },
    onDataPart: data => {
      console.log(data);
    },

    onFilePart: file => {
      console.log(file);
    },
    onErrorPart: error => {
      console.log(error);
    },
  });
}

main().catch(console.error);
