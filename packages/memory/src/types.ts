export type WorkingMemoryFormat = 'json' | 'markdown';

export type WorkingMemoryTemplate = {
  format: WorkingMemoryFormat;
  content: string;
};
