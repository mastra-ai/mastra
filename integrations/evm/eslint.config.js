import { createConfig } from '@internal/lint/eslint';

const config = await createConfig();

export default [...config];
