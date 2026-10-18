import { valueC } from '@inner/transitive-c';

export enum Greeting {
  Hello = 'hello',
}

// @inner/transitive-c is only declared by this package, so it must resolve from here, not from the app.
export const greet = (name: string): string => `${Greeting.Hello} ${name} ${valueC}`;
