import { describe, it, beforeAll } from '@jest/globals';
import dotenv from 'dotenv';

import { AstraDb } from './';

dotenv.config();

const ASTRA_DB_APP_TOKEN = process.env.ASTRA_DB_APP_TOKEN!;
const ASTRA_DB_ENDPOINT = process.env.ASTRA_DB_ENDPOINT!;

if (!(ASTRA_DB_APP_TOKEN && ASTRA_DB_ENDPOINT)) {
  throw new Error('Please set ASTRA_DB_APP_TOKEN and ASTRA_DB_ENDPOINT in .env file');
}

describe('AstraDB Integration Tests', () => {});
