// src/model-context/ModelContextTypes.ts
var mergeModelContexts = (configSet) => {
  const configs = Array.from(configSet).map((c) => c.getModelContext()).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return configs.reduce((acc, config) => {
    if (config.system) {
      if (acc.system) {
        acc.system += `

${config.system}`;
      } else {
        acc.system = config.system;
      }
    }
    if (config.tools) {
      for (const [name, tool] of Object.entries(config.tools)) {
        const existing = acc.tools?.[name];
        if (existing && existing !== tool) {
          throw new Error(
            `You tried to define a tool with the name ${name}, but it already exists.`
          );
        }
        if (!acc.tools) acc.tools = {};
        acc.tools[name] = tool;
      }
    }
    if (config.config) {
      acc.config = {
        ...acc.config,
        ...config.config
      };
    }
    if (config.callSettings) {
      acc.callSettings = {
        ...acc.callSettings,
        ...config.callSettings
      };
    }
    return acc;
  }, {});
};
export {
  mergeModelContexts
};
//# sourceMappingURL=ModelContextTypes.js.map