export const prefix = 'cjs';
export default function describe(name) {
  return `${prefix} requires esm ${name}`;
}
