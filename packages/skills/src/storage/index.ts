// Skills storage (for SKILL.md files)
export * from './filesystem';

// Knowledge storage (for artifact namespaces) - exported as KnowledgeFilesystemStorage to avoid conflict
export { FilesystemStorage as KnowledgeFilesystemStorage } from './knowledge-filesystem';
