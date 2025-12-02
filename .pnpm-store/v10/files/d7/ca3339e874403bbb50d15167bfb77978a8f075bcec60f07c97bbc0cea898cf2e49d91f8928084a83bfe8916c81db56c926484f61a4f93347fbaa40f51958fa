export const expandJsdocs = (jsdocs) => {
    const lines = jsdocs.split("\n");
    const result = lines.length === 1
        ? lines[0]
        : `\n${lines.map(x => `* ${x}`)
            .join("\n")}\n`;
    return `/**${result}*/\n`;
};
export const addJsdocs = (schema, parsed) => {
    const description = schema.description;
    if (!description) {
        return parsed;
    }
    return `\n${expandJsdocs(description)}${parsed}`;
};
