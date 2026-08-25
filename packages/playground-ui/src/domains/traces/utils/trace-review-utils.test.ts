import { describe, expect, it } from 'vitest';
import { getReadableTraceInput, getReadableTraceOutput } from './trace-review-utils';

describe('getReadableTraceInput', () => {
  describe('when the input is an agent message array', () => {
    it('returns only the user message text', () => {
      const input = [
        { role: 'system', content: 'You are a clinician.' },
        { role: 'user', content: 'A patient reports chest pain.' },
      ];

      expect(getReadableTraceInput(input)).toBe('A patient reports chest pain.');
    });

    it('joins multiple user messages with blank lines', () => {
      const input = [
        { role: 'user', content: 'First message.' },
        { role: 'assistant', content: 'Reply.' },
        { role: 'user', content: 'Second message.' },
      ];

      expect(getReadableTraceInput(input)).toBe('First message.\n\nSecond message.');
    });

    it('extracts text parts from structured message content', () => {
      const input = [{ role: 'user', content: [{ type: 'text', text: 'Structured part.' }] }];

      expect(getReadableTraceInput(input)).toBe('Structured part.');
    });
  });

  describe('when the input is a Mastra message object', () => {
    it('reads contents from a single user message object', () => {
      const input = {
        contents: 'A 35-year-old woman has fever and headache.',
        metadata: { clientMessageId: 'client-1' },
        type: 'user',
        tagName: 'user',
        id: 'msg-1',
        toDBMessage: '[Function]',
      };

      expect(getReadableTraceInput(input)).toBe('A 35-year-old woman has fever and headache.');
    });

    it('reads contents from an array of typed messages without leaking framework fields', () => {
      const input = [
        { contents: 'First question.', type: 'user', id: 'msg-1', acceptedAt: '2026-08-21T00:00:00Z' },
        { contents: 'Assistant reply.', type: 'assistant', id: 'msg-2' },
        { contents: 'Second question.', type: 'user', id: 'msg-3' },
      ];

      expect(getReadableTraceInput(input)).toBe('First question.\n\nSecond question.');
    });
  });

  describe('when the input uses the legacy messages wrapper', () => {
    it('unwraps the messages array', () => {
      const input = { messages: [{ role: 'user', content: 'Wrapped case.' }] };

      expect(getReadableTraceInput(input)).toBe('Wrapped case.');
    });
  });

  describe('when the input is a plain string', () => {
    it('returns the string unchanged', () => {
      expect(getReadableTraceInput('Plain case text.')).toBe('Plain case text.');
    });

    it('drops whitespace-only text', () => {
      expect(getReadableTraceInput([{ role: 'user', content: '   ' }])).toBe('');
    });
  });

  describe('when message content mixes field shapes', () => {
    it('falls back from a non-string text field to the content field', () => {
      const input = [{ role: 'user', content: [{ text: 42, content: 'Fallback content.' }] }];

      expect(getReadableTraceInput(input)).toBe('Fallback content.');
    });

    it('reads a string value field', () => {
      const input = [{ role: 'user', content: [{ value: 'Value text.' }] }];

      expect(getReadableTraceInput(input)).toBe('Value text.');
    });
  });

  describe('when the input is a structured object without messages', () => {
    it('formats keys as readable labels', () => {
      const formatted = getReadableTraceInput({ labResults: 'WBC 14,000', patientAge: 58 });

      expect(formatted).toBe('Lab results: WBC 14,000\nPatient age: 58');
    });

    it('converts underscore keys to single spaces', () => {
      expect(getReadableTraceInput({ medical__history: 'asthma' })).toBe('Medical history: asthma');
    });

    it('formats nested arrays as indented lists', () => {
      const formatted = getReadableTraceInput({ medications: ['lisinopril', 'metformin'] });

      expect(formatted).toBe('Medications:\n  - lisinopril\n  - metformin');
    });

    it('omits empty values', () => {
      const formatted = getReadableTraceInput({ history: '', symptoms: 'nausea' });

      expect(formatted).toBe('Symptoms: nausea');
    });
  });

  describe('when the input is missing', () => {
    it('returns an empty string', () => {
      expect(getReadableTraceInput(null)).toBe('');
      expect(getReadableTraceInput(undefined)).toBe('');
    });
  });
});

describe('getReadableTraceOutput', () => {
  describe('when the output is an assistant message array', () => {
    it('returns the assistant message text', () => {
      const output = [
        { role: 'user', content: 'Question.' },
        { role: 'assistant', content: 'The likely diagnosis is appendicitis.' },
      ];

      expect(getReadableTraceOutput(output)).toBe('The likely diagnosis is appendicitis.');
    });
  });

  describe('when the output is an object with a text field', () => {
    it('returns the text field', () => {
      expect(getReadableTraceOutput({ text: 'Diagnosis summary.' })).toBe('Diagnosis summary.');
    });
  });

  describe('when the output nests text under a result field', () => {
    it('returns the nested text', () => {
      expect(getReadableTraceOutput({ result: { text: 'Nested result.' } })).toBe('Nested result.');
    });
  });

  describe('when the output is a plain string', () => {
    it('returns the string unchanged', () => {
      expect(getReadableTraceOutput('Direct answer.')).toBe('Direct answer.');
    });
  });

  describe('when the output is a structured object without text', () => {
    it('formats keys as readable labels', () => {
      expect(getReadableTraceOutput({ confidenceLevel: 'moderate' })).toBe('Confidence level: moderate');
    });
  });

  describe('when the output is missing', () => {
    it('returns an empty string', () => {
      expect(getReadableTraceOutput(null)).toBe('');
    });
  });
});
