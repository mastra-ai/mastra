import { registerRenderTasks } from '../src/worker.js';
import { mastra, nativeProof } from './fixture.js';

registerRenderTasks({ mastra, nativeTasks: [nativeProof] });
