import { Agent } from '@mastra/core/agent';
import { join } from 'path';

async function main() {
  const catSkillPath = join(process.cwd(), '.mastra/skills/cat-expert');
  const dogSkillPath = join(process.cwd(), '.mastra/skills/dog-expert');

  // Agent with Cat Skill
  const catAgent = new Agent({
    name: 'Cat Lover',
    instructions: 'You are a helpful assistant.',
    model: {
      provider: 'OPENAI',
      name: 'gpt-4o',
      toolChoice: 'auto',
    },
    skills: [catSkillPath],
  });

  console.log('🐱 Talking to Cat Agent...');
  const catResponse = await catAgent.generate({
    messages: [{ role: 'user', content: 'What is the best pet?' }],
  });
  console.log(catResponse.text);

  // Agent with Dog Skill
  const dogAgent = new Agent({
    name: 'Dog Lover',
    instructions: 'You are a helpful assistant.',
    model: {
      provider: 'OPENAI',
      name: 'gpt-4o',
      toolChoice: 'auto',
    },
    skills: [dogSkillPath],
  });

  console.log('\n🐶 Talking to Dog Agent...');
  const dogResponse = await dogAgent.generate({
    messages: [{ role: 'user', content: 'What is the best pet?' }],
  });
  console.log(dogResponse.text);

  // Agent with Dynamic Skills
  const dynamicAgent = new Agent({
    name: 'Pet Expert',
    instructions: 'You are an objective pet expert.',
    model: {
      provider: 'OPENAI',
      name: 'gpt-4o',
      toolChoice: 'auto',
    },
    skills: async ({ requestContext }) => {
      const topic = requestContext?.get('topic');
      if (topic === 'cats') return [catSkillPath];
      if (topic === 'dogs') return [dogSkillPath];
      // Load both if generic
      return [catSkillPath, dogSkillPath];
    },
  });

  // console.log('\n🐾 Talking to Dynamic Agent (Generic)...');
  // const dynamicResponse = await dynamicAgent.generate({
  //   messages: [{ role: 'user', content: 'Tell me about pets.' }],
  // });
  // console.log(dynamicResponse.text);
}

main().catch(console.error);
