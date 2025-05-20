export const baseAttributes = {
  createdAt: {
    type: 'string',
    required: true,
    readOnly: true,
    // Convert Date to ISO string on set
    set: (value?: Date | string) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value || new Date().toISOString();
    },
    // Initialize with current timestamp if not provided
    default: () => new Date().toISOString(),
  },
  updatedAt: {
    type: 'string',
    required: true,
    // Convert Date to ISO string on set
    set: (value?: Date | string) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value || new Date().toISOString();
    },
    // Always use current timestamp when creating/updating
    default: () => new Date().toISOString(),
  },
  metadata: {
    type: 'string', // JSON stringified
    // Stringify objects on set
    set: (value?: Record<string, unknown> | string) => {
      if (value && typeof value !== 'string') {
        return JSON.stringify(value);
      }
      return value;
    },
    // Parse JSON string to object on get
    get: (value?: string) => {
      if (value) {
        try {
          return JSON.parse(value);
        } catch {
          // If parsing fails, return the original string
          return value;
        }
      }
      return value;
    },
  },
} as const;
