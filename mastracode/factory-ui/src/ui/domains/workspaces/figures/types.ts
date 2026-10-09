export type FigureMode = 'shared' | 'individual' | 'hybrid';
export type FigureScene = 'factory' | 'codebase' | 'intake' | 'accounts';
export interface FigureDefinition {
  name: string;
  means: string;
  rules: number[];
  range: [number, number, number];
  tour: ([number, number] | null)[];
  mount: (
    elements: { stage: HTMLElement; svg: SVGSVGElement; read: { textContent: string } },
    intensity: number,
  ) => {
    set: (value: number) => void;
    destroy: () => void;
    setMode?: (mode: FigureMode) => void;
    setScene?: (scene: FigureScene, immediate?: boolean) => void;
  };
}
