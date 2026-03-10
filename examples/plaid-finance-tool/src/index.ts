import { mastra } from './mastra';

async function main() {
  const financeAgent = mastra.getAgent('financeAgent');
  const response = await financeAgent.generate('Create a sandbox token, then fetch my account balances');

  console.log(response);
}

main().catch(error => {
  console.error('Fatal error in main:', error);
  process.exit(1);
});
