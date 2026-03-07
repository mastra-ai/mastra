import 'dotenv/config';
import { mastra } from './mastra/index';


async function runResearchPipeline(topic: string) {
  console.log(`\n🔍 Starting research pipeline for: "${topic}"\n`);
  console.log('='.repeat(60));

  
  console.log('\n📚 Step 1: Researcher agent gathering information...\n');
  const researcher = mastra.getAgent('researcherAgent');
  
  const researchResult = await researcher.generate(
    `Research the following topic thoroughly: ${topic}`
  );

  console.log('✅ Research complete\n');
  console.log('-'.repeat(60));

  
  console.log('\n✍️  Step 2: Writer agent creating report...\n');
  const writer = mastra.getAgent('writerAgent');

  const reportResult = await writer.generate(
    `Transform these research notes into a polished report:\n\n${researchResult.text}`
  );

  console.log('✅ Report complete\n');
  console.log('='.repeat(60));
  console.log('\n📄 FINAL REPORT\n');
  console.log('='.repeat(60));
  console.log(reportResult.text);
  console.log('='.repeat(60));


  return {
    research: researchResult.text,
    report: reportResult.text,
  };
}


const topic = process.argv[2] || 'the impact of large language models on software development';

runResearchPipeline(topic).catch(console.error);