import { Ajv } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';

export const aliasValidators = [new Ajv(), new Ajv2020()];
