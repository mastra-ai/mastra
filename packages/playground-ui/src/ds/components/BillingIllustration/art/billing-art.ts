export type BillingArtStroke = 'solid' | 'edge' | 'line' | 'light' | 'idle';

export type BillingArtPaths = ReadonlyArray<readonly [BillingArtStroke, string]>;

export type BillingArt = {
  viewBox: readonly [x: number, y: number, width: number, height: number];
  paths: BillingArtPaths;
  lifts?: ReadonlyArray<BillingArtPaths>;
  enters?: ReadonlyArray<BillingArtPaths>;
  dashed?: boolean;
};
