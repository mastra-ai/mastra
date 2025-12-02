const capitalize = (str) => {
  if (!str || str.length === 0)
    return "";
  const lower = str.toLowerCase();
  return lower.substring(0, 1).toUpperCase() + lower.substring(1, lower.length);
};
const camel = (str) => {
  const parts = str?.replace(/([A-Z])+/g, capitalize)?.split(/(?=[A-Z])|[\.\-\s_]/).map((x) => x.toLowerCase()) ?? [];
  if (parts.length === 0)
    return "";
  if (parts.length === 1)
    return parts[0];
  return parts.reduce((acc, part) => {
    return `${acc}${part.charAt(0).toUpperCase()}${part.slice(1)}`;
  });
};
const snake = (str, options) => {
  const parts = str?.replace(/([A-Z])+/g, capitalize).split(/(?=[A-Z])|[\.\-\s_]/).map((x) => x.toLowerCase()) ?? [];
  if (parts.length === 0)
    return "";
  if (parts.length === 1)
    return parts[0];
  const result = parts.reduce((acc, part) => {
    return `${acc}_${part.toLowerCase()}`;
  });
  return options?.splitOnNumber === false ? result : result.replace(/([A-Za-z]{1}[0-9]{1})/, (val) => `${val[0]}_${val[1]}`);
};
const dash = (str) => {
  const parts = str?.replace(/([A-Z])+/g, capitalize)?.split(/(?=[A-Z])|[\.\-\s_]/).map((x) => x.toLowerCase()) ?? [];
  if (parts.length === 0)
    return "";
  if (parts.length === 1)
    return parts[0];
  return parts.reduce((acc, part) => {
    return `${acc}-${part.toLowerCase()}`;
  });
};
const pascal = (str) => {
  const parts = str?.split(/[\.\-\s_]/).map((x) => x.toLowerCase()) ?? [];
  if (parts.length === 0)
    return "";
  return parts.map((str2) => str2.charAt(0).toUpperCase() + str2.slice(1)).join("");
};
const title = (str) => {
  if (!str)
    return "";
  return str.split(/(?=[A-Z])|[\.\-\s_]/).map((s) => s.trim()).filter((s) => !!s).map((s) => capitalize(s.toLowerCase())).join(" ");
};
const template = (str, data, regex = /\{\{(.+?)\}\}/g) => {
  return Array.from(str.matchAll(regex)).reduce((acc, match) => {
    return acc.replace(match[0], data[match[1]]);
  }, str);
};
const trim = (str, charsToTrim = " ") => {
  if (!str)
    return "";
  const toTrim = charsToTrim.replace(/[\W]{1}/g, "\\$&");
  const regex = new RegExp(`^[${toTrim}]+|[${toTrim}]+$`, "g");
  return str.replace(regex, "");
};

export { camel, capitalize, dash, pascal, snake, template, title, trim };
//# sourceMappingURL=string.mjs.map
