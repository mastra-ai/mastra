import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface ActivatedSkillsContextValue {
  /** Set of currently activated skill names */
  activatedSkills: Set<string>;
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

export function useActivatedSkills(): ActivatedSkillsContextValue {
  const context = useContext(ActivatedSkillsContext);
  if (!context) {
    // Return a no-op implementation if context is not available
    // This allows components to work without the provider
    return {
      activatedSkills: new Set(),
      activateSkill: () => {},
      deactivateSkill: () => {},
      isSkillActivated: () => false,
      clearActivatedSkills: () => {},
    };
  }
  return context;
}
