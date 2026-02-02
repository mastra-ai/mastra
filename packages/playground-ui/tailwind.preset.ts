import type { Config } from 'tailwindcss';
import tailwindConfig from './tailwind.config';

const { content, ...preset } = tailwindConfig;
export default preset as Partial<Config>;
