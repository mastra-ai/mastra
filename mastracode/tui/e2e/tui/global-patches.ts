type Cleanup = () => void;

export type GlobalPatchScope = {
  setEnv(name: string, value: string): void;
  setProperty<T extends object, K extends keyof T>(target: T, key: K, value: T[K]): void;
  restore(): void;
  stopApp(appStop?: () => Promise<void> | void): Promise<void>;
};

export function createGlobalPatchScope(): GlobalPatchScope {
  const cleanups: Cleanup[] = [];
  let restored = false;

  return {
    setEnv(name, value) {
      const previous = process.env[name];
      process.env[name] = value;
      cleanups.push(() => {
        if (previous === undefined) delete process.env[name];
        else process.env[name] = previous;
      });
    },
    setProperty(target, key, value) {
      const previous = target[key];
      target[key] = value;
      cleanups.push(() => {
        target[key] = previous;
      });
    },
    restore() {
      if (restored) return;
      restored = true;
      for (const cleanup of cleanups.reverse()) cleanup();
    },
    async stopApp(appStop) {
      try {
        await appStop?.();
      } finally {
        this.restore();
      }
    },
  };
}
