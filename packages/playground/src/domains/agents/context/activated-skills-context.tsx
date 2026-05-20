import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback } from 'react';

export interface ActivatedSkillsContextValue {
  /** Set of currently activated skill names */
  activatedSkills: ReadonlySet<string>;
  /** Add a skill to the activated set */
  activateSkill: (skillName: string) => void;
  /** Remove a skill from the activated set */
  deactivateSkill: (skillName: string) => void;
  /** Check if a skill is activated */
  isSkillActivated: (skillName: string) => boolean;
  /** Clear all activated skills */
  clearActivatedSkills: () => void;
}

const ActivatedSkillsContext = createContext<ActivatedSkillsContextValue | null>(null);

export interface ActivatedSkillsProviderProps {
  children: ReactNode;
}

export function ActivatedSkillsProvider({ children }: ActivatedSkillsProviderProps) {
  const [activatedSkills, setActivatedSkills] = useState<Set<string>>(new Set());

  const activateSkill = useCallback((skillName: string) => {
    setActivatedSkills(prev => {
      if (prev.has(skillName)) return prev;
      const next = new Set(prev);
      next.add(skillName);
      return next;
    });
  }, []);

  const deactivateSkill = useCallback((skillName: string) => {
    setActivatedSkills(prev => {
      const next = new Set(prev);
      next.delete(skillName);
      return next;
    });
  }, []);

  const isSkillActivated = useCallback((skillName: string) => activatedSkills.has(skillName), [activatedSkills]);

  const clearActivatedSkills = useCallback(() => {
    setActivatedSkills(new Set());
  }, []);

  return (
    <ActivatedSkillsContext.Provider
      value={{
        activatedSkills,
        activateSkill,
        deactivateSkill,
        isSkillActivated,
        clearActivatedSkills,
      }}
    >
      {children}
    </ActivatedSkillsContext.Provider>
  );
}

const FALLBACK_CONTEXT: ActivatedSkillsContextValue = {
  activatedSkills: new Set<string>(),
  activateSkill: () => {},
  deactivateSkill: () => {},
  isSkillActivated: () => false,
  clearActivatedSkills: () => {},
};

export function useActivatedSkills(): ActivatedSkillsContextValue {
  return useContext(ActivatedSkillsContext) ?? FALLBACK_CONTEXT;
}
