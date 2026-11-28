export interface MastraGatewayCredits {
  /** Dollars (1 credit = $1); absent when the platform reports no balance for the pool. */
  remaining?: number;
  unlimited: boolean;
  /** Mastra lets only organization admins buy credits. */
  canAddCredits: boolean;
  addCreditsUrl: string;
}
