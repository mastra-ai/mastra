export interface InteractiveLocalCommerce {
  purchase: {
    orderId: string;
    product: string;
    amountMinor: number;
    currency: string;
    purchasedAt: string;
  };
}
export function addCalendarMonthClamped(value: Date | string): string;
export function interactiveLocalCommerce(
  seedAt?: Date | string,
): InteractiveLocalCommerce;
export function localDemoSeedInstant(environment?: NodeJS.ProcessEnv): string;
