import { mastra } from './mastra';

async function main() {
  const financeAgent = mastra.getAgent('financeAgent');
  const response = await financeAgent.generate('Create a sandbox token, then fetch my account balances');

  console.log(response);
}

main();
