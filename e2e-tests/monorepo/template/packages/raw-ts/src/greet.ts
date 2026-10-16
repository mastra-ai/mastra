export enum Greeting {
  Hello = 'hello',
}

export const greet = (name: string): string => `${Greeting.Hello} ${name}`;
