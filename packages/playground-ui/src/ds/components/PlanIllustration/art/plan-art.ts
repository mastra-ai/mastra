export type PlanArtStroke = 'solid' | 'edge' | 'line' | 'light' | 'lamp';

export type PlanArt = {
  viewBox: readonly [x: number, y: number, width: number, height: number];
  paths: ReadonlyArray<readonly [PlanArtStroke, string]>;
};
