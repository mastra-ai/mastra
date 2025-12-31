// Skills processor (for Skills class / SKILL.md files)
// Implements Agent Skills spec progressive disclosure model
export * from './skills';

// Knowledge processors (for Knowledge class / namespace artifacts)
export * from './static-knowledge';
export * from './retrieved-knowledge';

// Note: StaticSkills and RetrievedSkills were removed as they don't align
// with the Agent Skills spec. Use SkillsProcessor instead.
