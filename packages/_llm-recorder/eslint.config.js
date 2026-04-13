import { createConfig } from '@internal/lint/eslint';

/** @type {import("eslint").Linter.Config[]} */
const config = await createConfig();

export default [...config];
