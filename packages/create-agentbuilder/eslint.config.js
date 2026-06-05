import { createConfig } from '@internal/lint/eslint';

const config = await createConfig({ e18e: true });

/** @type {import("eslint").Linter.Config[]} */
export default [...config.map(conf => ({ ...conf, ignores: [...(conf.ignores || []), '**/starter-files/**'] }))];
