
type pair = string[]

interface Model {
  rules: pair[],
  rev: pair[],
  exceptions: object,
  reversed?: boolean
}

export function learn(input: pair[], opts?: object): Model;
export function convert(word: string, model: Model, debug?: boolean): string;
export function compress(model: Model): string;
export function uncompress(model: string): Model;
export function reverse(model: Model): Model;
export function validate(input: pair[]): pair[];
export function test(input: pair[], opts?: object): void;
export function classify(word: string, model: Model, debug?: boolean): 'Left' | 'Right' | null;
