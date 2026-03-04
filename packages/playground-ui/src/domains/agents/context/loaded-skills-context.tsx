import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface LoadedSkillsContextValue {
  /** Set of skill names that have been loaded (via the `skill` tool) in this session */
  loadedSkills: ReadonlySet<string>;
  /** Mark a skill as loaded */
  markSkillLoaded: (skillName: string) => void;
  /** Check if a skill has been loaded */
  isSkillLoaded: (skillName: string) => boolean;
  /** Clear all loaded skills */
  clearLoadedSkills: () => void;
}

const LoadedSkillsContext = createContext<LoadedSkillsContextValue | null>(null);

export interface LoadedSkillsProviderProps {
  children: ReactNode;
}

export function LoadedSkillsProvider({ children }: LoadedSkillsProviderProps) {
  const [loadedSkills, setLoadedSkills] = useState<Set<string>>(new Set());

  const markSkillLoaded = useCallback((skillName: string) => {
    setLoadedSkills(prev => {
      if (prev.has(skillName)) return prev;
      const next = new Set(prev);
      next.add(skillName);
      return next;
    });
  }, []);

  const isSkillLoaded = useCallback((skillName: string) => loadedSkills.has(skillName), [loadedSkills]);

  const clearLoadedSkills = useCallback(() => {
    setLoadedSkills(new Set());
  }, []);

  return (
    <LoadedSkillsContext.Provider
      value={{
        loadedSkills,
        markSkillLoaded,
        isSkillLoaded,
        clearLoadedSkills,
      }}
    >
      {children}
    </LoadedSkillsContext.Provider>
  );
}

export function useLoadedSkills(): LoadedSkillsContextValue {
  const context = useContext(LoadedSkillsContext);
  if (!context) {
    return {
      loadedSkills: new Set(),
      markSkillLoaded: () => {},
      isSkillLoaded: () => false,
      clearLoadedSkills: () => {},
    };
  }
  return context;
}

/** @deprecated Use `LoadedSkillsProvider` instead */
export const ActivatedSkillsProvider = LoadedSkillsProvider;
/** @deprecated Use `useLoadedSkills` instead */
export const useActivatedSkills = useLoadedSkills;
