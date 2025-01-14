import { createPrompt } from './index';

describe('Prompt Techniques', () => {
  describe('Zero Shot', () => {
    it('should create a basic zero shot prompt', () => {
      const prompt = createPrompt('What is the capital of France?', {});
      const result = prompt.toString();
      expect(result).toContain('What is the capital of France?');
    });
  });

  describe('Chain of Thought', () => {
    it('should create a chain of thought prompt', () => {
      const prompt = createPrompt('If John has 5 apples and gives 2 to Mary, how many does he have left?', {}).thinking(
        {
          autoChainOfThought: true,
        },
      );
      const result = prompt.toString();
      expect(result).toContain("Let's solve this step by step");
      expect(result).toContain('If John has 5 apples');
    });
  });

  describe('Tree of Thought', () => {
    it('should create an auto tree of thought prompt', () => {
      const prompt = createPrompt('What career path should a software engineer take to become a CTO?', {}).thinking({
        autoTreeOfThought: true,
      });
      const result = prompt.toString();
      expect(result).toContain('multiple ways of solving');
      expect(result).toContain('software engineer');
    });

    it('should create a manual tree of thought prompt with branches', () => {
      const branches = {
        'Technical Path': [
          'Focus on deep technical expertise',
          'Lead technical projects',
          'Become technical architect',
        ],
        'Management Path': ['Start with team lead role', 'Move to engineering manager', 'Director of engineering'],
      };
      const prompt = createPrompt('What career path should a software engineer take to become a CTO?', {}).thinking({
        branches,
      });
      const result = prompt.toString();
      expect(result).toContain('Technical Path');
      expect(result).toContain('Management Path');
      expect(result).toContain('Focus on deep technical expertise');
      expect(result).toContain('Director of engineering');
    });
  });

  describe('Self Ask', () => {
    it('should create a self ask prompt', () => {
      const prompt = createPrompt('How does photosynthesis work?', {}).thinking({
        autoSelfAsk: true,
      });
      const result = prompt.toString();
      expect(result).toContain("Let's break this down by asking ourselves questions");
      expect(result).toContain('How does photosynthesis work?');
    });
  });

  describe('Self Verification', () => {
    it('should create an auto self verification prompt', () => {
      const prompt = createPrompt('Calculate 15% of $85', {}).thinking({
        autoVerification: true,
      });
      const result = prompt.toString();
      expect(result).toContain("Let's verify our solution");
      expect(result).toContain('Calculate 15% of $85');
    });

    it('should create a manual self verification prompt with steps', () => {
      const verificationSteps = [
        'Check if decimal placement is correct',
        'Verify percentage calculation',
        'Ensure currency formatting is proper',
      ];
      const prompt = createPrompt('Calculate 15% of $85', {}).thinking({
        verificationSteps,
      });
      const result = prompt.toString();
      expect(result).toContain('Check if decimal placement is correct');
      expect(result).toContain('Verify percentage calculation');
      expect(result).toContain('Ensure currency formatting is proper');
    });
  });

  describe('Few Shot', () => {
    it('should create a few shot prompt with examples', () => {
      const examples = [
        {
          input: 'What is 10% of $100?',
          output: '$10',
        },
        {
          input: 'What is 20% of $50?',
          output: '$10',
        },
      ];
      const prompt = createPrompt('What is 25% of $120?', {}).examples(examples);
      const result = prompt.toString();
      expect(result).toContain('What is 10% of $100?');
      expect(result).toContain('$10');
      expect(result).toContain('What is 20% of $50?');
      expect(result).toContain('What is 25% of $120?');
    });
  });

  describe('Role Prompt', () => {
    it('should create a role prompt', () => {
      const prompt = createPrompt('Explain quantum computing', {
        persona: 'Quantum Physics Professor',
      });
      const result = prompt.toString();
      expect(result).toContain('As a QUANTUM PHYSICS PROFESSOR');
      expect(result).toContain('Explain quantum computing');
    });
  });

  describe('Variable Handling', () => {
    it('should handle variables in prompts', () => {
      const variables = {
        country: 'France',
      };

      const prompt = createPrompt<{ country: string }>('Get country capital', {}).text(
        'What is the capital of {{country}}?',
      );

      const result = prompt.toString({ country: variables.country });
      expect(result).toContain('What is the capital of France?');
    });
  });

  describe('Message (as) role Format', () => {
    it('should create a message role format', () => {
      const prompt = createPrompt('Explain quantum computing', {
        as: 'system',
      });
      const result = prompt.toMessage();
      expect(result.content).toContain('Explain quantum computing');
    });
  });
});
