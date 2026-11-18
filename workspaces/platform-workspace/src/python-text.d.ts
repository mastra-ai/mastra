/** Python sources bundled as their text (tsdown `loader: { '.py': 'text' }`, and the vitest plugin in `vitest.config.ts`). */
declare module '*.py' {
  const source: string;
  export default source;
}
