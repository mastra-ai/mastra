export const makeMastraFile = (code: string) => {
  return `import { Mastra } from '@mastra/core/mastra';

${code}

export const mastra = new Mastra({
  workflows: { workflow },
});
`;
};
