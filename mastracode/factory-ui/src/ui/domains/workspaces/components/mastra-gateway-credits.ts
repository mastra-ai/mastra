const WHOLE_DOLLARS = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function formatWholeDollars(amount: number): string {
  return WHOLE_DOLLARS.format(amount);
}

export const ASK_ADMIN_FOR_CREDITS = 'Ask an admin of your Mastra organization to add credits.';
