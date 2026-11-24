export interface NonLatin1Character {
  line: number;
  column: number;
  codePoint: number;
}

export function findNonLatin1InCode(code: string, fileName: string): NonLatin1Character[];

export function findNonLatin1InDist(distDir: string): string[];

export function assertLatin1Dist(distDir: string): void;
