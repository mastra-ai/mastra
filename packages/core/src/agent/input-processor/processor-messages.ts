import type { MastraMessageV2 } from '../message-list';

export class ProcessorMessages {
  private messages: MastraMessageV2[] = [];

  constructor(messages: MastraMessageV2[] = []) {
    this.messages = [...messages];
  }

  /**
   * Add a new message
   */
  add(content: string, role: 'user' | 'assistant' = 'user'): ProcessorMessages {
    const message: MastraMessageV2 = {
      id: this.generateId(),
      role,
      content: {
        format: 2,
        parts: [
          {
            type: 'text',
            text: content,
          },
        ],
      },
      createdAt: new Date(),
    };

    this.messages.push(message);
    return this;
  }

  /**
   * Remove messages by ID
   */
  removeById(messageId: string): boolean {
    const initialLength = this.messages.length;
    this.messages = this.messages.filter(msg => msg.id !== messageId);
    return this.messages.length < initialLength;
  }

  /**
   * Remove messages by role
   */
  removeByRole(role: 'user' | 'assistant'): number {
    const initialLength = this.messages.length;
    this.messages = this.messages.filter(msg => msg.role !== role);
    return initialLength - this.messages.length;
  }

  /**
   * Remove messages matching a predicate
   */
  removeWhere(predicate: (message: MastraMessageV2) => boolean): number {
    const initialLength = this.messages.length;
    this.messages = this.messages.filter(msg => !predicate(msg));
    return initialLength - this.messages.length;
  }

  /**
   * Modify a message by ID
   */
  modifyById(messageId: string, updater: (message: MastraMessageV2) => MastraMessageV2): boolean {
    const index = this.messages.findIndex(msg => msg.id === messageId);
    if (index === -1) return false;

    const updated = updater(this.messages[index]!);
    // Preserve the original ID
    updated.id = messageId;
    this.messages[index] = updated;
    return true;
  }

  /**
   * Modify messages matching a predicate
   */
  modifyWhere(
    predicate: (message: MastraMessageV2) => boolean,
    updater: (message: MastraMessageV2) => MastraMessageV2,
  ): number {
    let modifiedCount = 0;
    this.messages = this.messages.map(msg => {
      if (predicate(msg)) {
        modifiedCount++;
        const updated = updater({ ...msg });
        // Preserve the original ID
        updated.id = msg.id;
        return updated;
      }
      return msg;
    });
    return modifiedCount;
  }

  /**
   * Filter messages and return a new ProcessorMessages instance
   */
  filter(predicate: (message: MastraMessageV2) => boolean): ProcessorMessages {
    return new ProcessorMessages(this.messages.filter(predicate));
  }

  /**
   * Get all messages
   */
  getAll(): MastraMessageV2[] {
    return [...this.messages];
  }

  /**
   * Get messages by role
   */
  getByRole(role: 'user' | 'assistant'): MastraMessageV2[] {
    return this.messages.filter(msg => msg.role === role);
  }

  /**
   * Get the latest message
   */
  getLatest(): MastraMessageV2 | undefined {
    return this.messages[this.messages.length - 1];
  }

  /**
   * Get the latest message by role
   */
  getLatestByRole(role: 'user' | 'assistant'): MastraMessageV2 | undefined {
    const filtered = this.getByRole(role);
    return filtered[filtered.length - 1];
  }

  /**
   * Find a message by ID
   */
  findById(messageId: string): MastraMessageV2 | undefined {
    return this.messages.find(msg => msg.id === messageId);
  }

  /**
   * Find messages matching a predicate
   */
  findWhere(predicate: (message: MastraMessageV2) => boolean): MastraMessageV2[] {
    return this.messages.filter(predicate);
  }

  /**
   * Get message count
   */
  count(): number {
    return this.messages.length;
  }

  /**
   * Get message counts by role
   */
  getCounts(): { total: number; user: number; assistant: number } {
    const user = this.messages.filter(msg => msg.role === 'user').length;
    const assistant = this.messages.filter(msg => msg.role === 'assistant').length;
    return {
      total: this.messages.length,
      user,
      assistant,
    };
  }

  /**
   * Check if empty
   */
  isEmpty(): boolean {
    return this.messages.length === 0;
  }

  /**
   * Clear all messages
   */
  clear(): number {
    const count = this.messages.length;
    this.messages = [];
    return count;
  }

  /**
   * Get the text content of all messages concatenated
   */
  getTextContent(): string {
    return this.messages
      .map(msg =>
        msg.content.parts
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join(' '),
      )
      .join('\n');
  }

  /**
   * Get the text content of the latest user message
   */
  getLatestUserText(): string | undefined {
    const latestUser = this.getLatestByRole('user');
    if (!latestUser) return undefined;

    return (
      latestUser.content.parts
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join(' ') || undefined
    );
  }

  /**
   * Replace the text content of a message
   */
  replaceTextById(messageId: string, newText: string): boolean {
    return this.modifyById(messageId, msg => ({
      ...msg,
      content: {
        ...msg.content,
        parts: [
          {
            type: 'text',
            text: newText,
          },
        ],
      },
    }));
  }

  /**
   * Replace the text content of the latest message by role
   */
  replaceLatestText(role: 'user' | 'assistant', newText: string): boolean {
    const latest = this.getLatestByRole(role);
    if (!latest) return false;
    return this.replaceTextById(latest.id, newText);
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
