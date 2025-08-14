import { openai } from '@ai-sdk/openai-v5';
import { describe, it } from 'vitest';
import { RuntimeContext } from '../../runtime-context';
import { MastraLLMVNext } from './model.loop';

const model = new MastraLLMVNext({
    model: openai('gpt-4o-mini')
});


describe('MastraLLMVNext', () => {
    it('should generate text', async () => {
        const result = await model.__text({
            messages: [
                {
                    role: 'user',
                    content: 'Hello, how are you?'
                }
            ],
            runtimeContext: new RuntimeContext(),
        });

        console.log({ result });
    });
});