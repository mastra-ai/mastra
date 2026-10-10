import { registerRenderTasks } from '../src/worker.js';
import { mastra } from './native-fixture.js';
import { registerSubmissionProbe } from './submission-fixture.js';
const probe = registerSubmissionProbe(() => definitions);
const definitions = registerRenderTasks({ mastra, nativeTasks: [probe] });
