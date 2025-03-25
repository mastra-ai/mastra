import type { Memory } from "mem0ai";
export class Mem0Utils {

  private static readonly MEM0_CLIENT_CONFIG_OPTIONS = [
    'apiKey',
    'host',
    'organizationName',
    'projectName',
    'organizationId',
    'projectId',
  ];

  static convertCamelCaseToSnakeCase = (str: string) => {
    if (Mem0Utils.MEM0_CLIENT_CONFIG_OPTIONS.includes(str)) {
      return str;
    }
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  };
  
  static convertStringToMessages = (str: string) => {
    return str.split('\n').map((line) => {
      return {
        role: 'user',
        content: line,
      };
    });
  };
  
  static getMemoryString = (memory: Memory[]): string => {
      const MEMORY_STRING_PREFIX = "These are the memories I have stored. Give more weightage to the question by users and try to answer that first. You have to modify your answer based on the memories I have provided. If the memories are irrelevant you can ignore them. Also don't reply to this section of the prompt, or the memories, they are only for your reference. The MEMORIES of the USER are: \n\n";
      const memoryString = memory.map((memory) => `${memory.memory}`).join('\n') ?? '';
      if (memoryString.length > 0) {
      return `${MEMORY_STRING_PREFIX}${memoryString}`;
    }
    return '';
  };
}
