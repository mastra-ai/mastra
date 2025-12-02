type Alphabet = "a-z" | "A-Z" | "0-9" | "-_";
declare function createRandomStringGenerator<A extends Alphabet>(...baseAlphabets: A[]): <SubA extends Alphabet>(length: number, ...alphabets: SubA[]) => string;

export { createRandomStringGenerator };
