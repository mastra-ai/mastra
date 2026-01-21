import { describeDrizzleSchema } from '../../../../scripts/drizzle-schema-generator/test-utils';
import { createMastraSchema } from './index';

describeDrizzleSchema(createMastraSchema());
