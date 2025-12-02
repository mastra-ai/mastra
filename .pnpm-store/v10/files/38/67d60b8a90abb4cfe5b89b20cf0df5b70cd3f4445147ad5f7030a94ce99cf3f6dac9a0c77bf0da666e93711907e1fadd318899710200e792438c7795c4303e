import { WordBase } from "../lib/types";

export interface IConverter {
  transcriptionData: any;
  getLines: (lineLength: number) => WordBase[][];
  getHeaders?: () => string[];
}

export function isConverter(object: any): object is IConverter {
  return "transcriptionData" in object;
}
