/** @experimental Computer cards are on only when the experimental computer flag is set. */
export const computerCardsEnabled = (): boolean => process.env.MASTRA_EXPERIMENTAL_COMPUTER === 'true';
