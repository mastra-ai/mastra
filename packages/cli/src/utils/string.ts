export const toCamelCase = (str: string) => {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
};
