// Installed from outside the workspace globs, so only bundler.transpilePackages can make Mastra transpile it (#19380).
export interface Greeting {
  name: string;
}

export const greet = ({ name }: Greeting): string => `hello ${name} from node_modules`;
