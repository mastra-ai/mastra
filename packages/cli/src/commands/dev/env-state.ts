export function createEnvironmentState(environment: NodeJS.ProcessEnv = process.env) {
  const inheritedKeys = new Set(Object.keys(environment));
  let loadedKeys = new Set<string>();

  return {
    allowLoadedOverride(key: string) {
      inheritedKeys.delete(key);
      delete environment[key];
    },

    sync(loadedEnv: Map<string, string>) {
      for (const key of loadedKeys) {
        if (!loadedEnv.has(key)) delete environment[key];
      }

      loadedKeys = new Set();
      for (const [key, value] of loadedEnv) {
        if (inheritedKeys.has(key)) continue;
        environment[key] = value;
        loadedKeys.add(key);
      }
    },

    getChildEnvironment(loadedEnv: Map<string, string>): NodeJS.ProcessEnv {
      return {
        ...environment,
        ...Object.fromEntries([...loadedEnv].filter(([key]) => !inheritedKeys.has(key))),
      };
    },
  };
}
