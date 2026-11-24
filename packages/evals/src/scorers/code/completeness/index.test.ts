import { describe, it, expect, beforeEach } from 'vitest';

import { createAgentTestRun, createTestMessage } from '../../utils';
import { createCompletenessScorer } from './index';

describe('CompletenessMetric', () => {
  let scorer;

  beforeEach(() => {
    scorer = createCompletenessScorer();
  });

  describe('basic functionality', () => {
    it('should return high score for identical text', async () => {
      const text = 'The quick brown fox jumps over the lazy dog';

      const inputMessages = [createTestMessage({ content: text, role: 'user', id: 'test-input' })];
      const output = [createTestMessage({ content: text, role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output });
      const result = await scorer.run(run);
      expect(result.score).toBeCloseTo(1.0);
      expect(result.preprocessStepResult?.elementCounts).toBeDefined();
    });

    it('should return lower score for simplified text missing elements', async () => {
      const original = 'The quick brown fox jumps over the lazy dog';
      const simplified = 'The fox jumps over the dog';

      const inputMessages = [createTestMessage({ content: original, role: 'user', id: 'test-input' })];
      const output = [createTestMessage({ content: simplified, role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output });
      const result = await scorer.run(run);

      expect(result.score).toBeLessThan(1.0);
      expect(result.score).toBeGreaterThan(0.5);

      expect(result.preprocessStepResult?.missingElements).toContain('brown');
      expect(result.preprocessStepResult?.missingElements).toContain('lazy');
    });

    it('should handle completely different texts', async () => {
      const original = 'The weather is sunny today';
      const simplified = 'I like to eat pizza';

      const inputMessages = [createTestMessage({ content: original, role: 'user', id: 'test-input' })];
      const outputMessages = [createTestMessage({ content: simplified, role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output: outputMessages });
      const result = await scorer.run(run);

      expect(result.score).toBeLessThan(0.3);
      const { input, output } = result.preprocessStepResult?.elementCounts as { input: number; output: number };
      expect(input).toBeGreaterThan(0);
      expect(output).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle both empty strings', async () => {
      const inputMessages = [createTestMessage({ content: '', role: 'user', id: 'test-input' })];
      const outputMessages = [createTestMessage({ content: '', role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output: outputMessages });
      const result = await scorer.run(run);
      expect(result.score).toBe(1);
      const { input, output } = result.preprocessStepResult?.elementCounts as { input: number; output: number };
      expect(input).toBe(0);
      expect(output).toBe(0);
    });

    it('should handle empty original string', async () => {
      const inputMessages = [createTestMessage({ content: '', role: 'user', id: 'test-input' })];
      const outputMessages = [createTestMessage({ content: 'some text', role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output: outputMessages });
      const result = await scorer.run(run);
      expect(result.score).toBe(0);
    });

    it('should handle whitespace-only strings', async () => {
      const inputMessages = [createTestMessage({ content: '   \n  ', role: 'user', id: 'test-input' })];
      const outputMessages = [createTestMessage({ content: '  \n  ', role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output: outputMessages });
      const result = await scorer.run(run);
      expect(result.score).toBe(1);
      const { input, output } = result.preprocessStepResult?.elementCounts as { input: number; output: number };
      expect(input).toBe(0);
      expect(output).toBe(0);
    });

    it('should handle null and undefined inputs', async () => {
      // @ts-expect-error Testing invalid input
      await expect(scorer.run(createAgentTestRun({ inputMessages: null, output: null }))).rejects.toThrow();
      // @ts-expect-error Testing invalid input
      await expect(scorer.run(createAgentTestRun({ inputMessages: undefined, output: undefined }))).rejects.toThrow();
    });
  });

  describe('special cases', () => {
    it('should handle lists and enumerations', async () => {
      const inputMessages = [
        createTestMessage({ content: 'apples, oranges, and bananas', role: 'user', id: 'test-input' }),
      ];
      const outputMessages = [
        createTestMessage({ content: 'apples and bananas', role: 'assistant', id: 'test-output' }),
      ];

      const run = createAgentTestRun({ inputMessages, output: outputMessages });
      const result = await scorer.run(run);
      expect(result.score).toBeLessThan(0.8);
      expect(result.preprocessStepResult?.missingElements).toContain('oranges');
    });

    it('should handle repeated elements', async () => {
      const inputMessages = [createTestMessage({ content: 'cat cat cat cats', role: 'user', id: 'test-input' })];
      const outputMessages = [createTestMessage({ content: 'cat cats', role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output: outputMessages });
      const result = await scorer.run(run);
      expect(result.score).toBeGreaterThan(0.7);
    });

    it('should score a question that starts with "will"', async () => {
      const question = 'will Acme Box crash after the update?';

      const inputMessages = [createTestMessage({ content: question, role: 'user', id: 'test-input' })];
      const outputMessages = [createTestMessage({ content: question, role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output: outputMessages });
      const result = await scorer.run(run);
      expect(result.score).toBeCloseTo(1.0);
    });

    it.each([
      {
        language: 'Japanese',
        question: '注文はどこにあり、配達員はいつ到着しますか。',
        answer: '注文は配送中で、配達員は明日18:00までに到着します。',
        unrelated: '今週はヘッドホンがとてもお得です。',
        word: 'どこ',
      },
      {
        language: 'Arabic',
        question: 'أين طلبي رقم ٤٢ ومتى يصل المندوب؟',
        answer: 'طلبي رقم ٤٢ في الطريق، يصل المندوب غدًا قبل الساعة 18:00.',
        unrelated: 'لدينا خصومات رائعة على سماعات الرأس هذا الأسبوع.',
        word: '٤٢',
      },
      {
        language: 'Russian',
        question: 'Где мой заказ и когда приедет курьер?',
        answer: 'Ваш заказ в пути, курьер приедет завтра до 18:00.',
        unrelated: 'На этой неделе у нас отличные скидки на наушники.',
        word: 'заказ',
      },
      {
        language: 'Hindi',
        question: 'मेरा ऑर्डर कहाँ है और कूरियर कब आएगा?',
        answer: 'आपका ऑर्डर रास्ते में है, कूरियर कल 18:00 बजे तक आएगा।',
        unrelated: 'इस हफ़्ते हेडफ़ोन पर बड़ी छूट है।',
        word: 'ऑर्डर',
      },
      {
        language: 'Thai',
        question: 'สั่งเสื้อ3ตัวราคา500บาทได้ไหม',
        answer: 'สั่งเสื้อ 3 ตัวได้ ราคา 500 บาท',
        unrelated: 'สัปดาห์นี้หูฟังลดราคา',
        word: '500',
      },
    ])('should score an on-topic $language answer above an unrelated one', async ({ word, question, ...answers }) => {
      const score = async (content: string) =>
        scorer.run(
          createAgentTestRun({
            inputMessages: [createTestMessage({ content: question, role: 'user', id: 'test-input' })],
            output: [createTestMessage({ content, role: 'assistant', id: 'test-output' })],
          }),
        );
      const onTopic = await score(answers.answer);
      const unrelated = await score(answers.unrelated);

      expect(unrelated.score).toBeLessThan(0.2);
      expect(onTopic.score).toBeGreaterThan(0.4);
      expect(onTopic.preprocessStepResult?.inputElements).toContain(word);
    });

    it.each([
      ['〇', '', 0],
      ['一〇〇円', '一円', 2 / 3],
      ['፲፰ ሰዓት', '፲፪ ሰዓት', 2 / 3],
    ])('should not match the number in "%s" with "%s"', async (question, answer, score) => {
      const inputMessages = [createTestMessage({ content: question, role: 'user', id: 'test-input' })];
      const output = [createTestMessage({ content: answer, role: 'assistant', id: 'test-output' })];

      const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
      expect(result.score).toBeCloseTo(score);
    });

    it('should not count emoji and signs in Latin text as words', async () => {
      const inputMessages = [createTestMessage({ content: 'ℹ️ Step 1️⃣: 180 ºC', role: 'user', id: 'test-input' })];
      const output = [createTestMessage({ content: 'Step 1: 180 °C', role: 'assistant', id: 'test-output' })];

      const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
      expect(result.score).toBe(1);
    });

    it('should handle long and multi-paragraph text', async () => {
      const original = `First paragraph about AI.
        Second paragraph about ML.
        Third paragraph about DL.`;
      const simplified = `First para about AI.
        Second para about ML.`;

      const inputMessages = [createTestMessage({ content: original, role: 'user', id: 'test-input' })];
      const outputMessages = [createTestMessage({ content: simplified, role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output: outputMessages });
      const result = await scorer.run(run);

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.preprocessStepResult?.missingElements).toBeDefined();
    });
  });
});
