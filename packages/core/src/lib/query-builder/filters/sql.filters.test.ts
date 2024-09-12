import { getFilterClauseSQL } from './sql';

describe('getFilterClauseSQL', () => {
  describe('DATE type', () => {
    it('Support DATE type less than value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          createdAt: {
            lt: 'Tue Jun 18 2024',
          },
        },
        fields: [
          {
            name: `createdAt`,
            type: `DATE`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((("kepler"."records"."createdAt" < '2024-06-18T00:00:00.000Z'::timestamp)))`
      );
    });

    it('Support DATE type greater than value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          createdAt: {
            gt: 'Tue Jun 18 2024',
          },
        },
        fields: [
          {
            name: `createdAt`,
            type: `DATE`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((("kepler"."records"."createdAt" > '2024-06-18T23:59:59.999Z'::timestamp)))`
      );
    });

    it('Support DATE type equal value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          createdAt: {
            eq: 'Tue Jun 18 2024',
          },
        },
        fields: [
          {
            name: `createdAt`,
            type: `DATE`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `(((("kepler"."records"."createdAt" >= '2024-06-18T00:00:00.000Z'::timestamp) AND ("kepler"."records"."createdAt" <= '2024-06-18T23:59:59.999Z'::timestamp))))`
      );
    });

    it('Support DATE type not equal value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          createdAt: {
            not_eq: 'Tue Jun 18 2024',
          },
        },
        fields: [
          {
            name: `createdAt`,
            type: `DATE`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `(((("kepler"."records"."createdAt" < '2024-06-18T00:00:00.000Z'::timestamp) OR ("kepler"."records"."createdAt" > '2024-06-18T23:59:59.999Z'::timestamp))))`
      );
    });

    it('Support DATE type greater than or equal value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          createdAt: {
            gte: 'Tue Jun 18 2024',
          },
        },
        fields: [
          {
            name: `createdAt`,
            type: `DATE`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((("kepler"."records"."createdAt" >= '2024-06-18T00:00:00.000Z'::timestamp)))`
      );
    });

    it('Support DATE type less than or equal value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          createdAt: {
            lte: 'Tue Jun 18 2024',
          },
        },
        fields: [
          {
            name: `createdAt`,
            type: `DATE`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((("kepler"."records"."createdAt" <= '2024-06-18T23:59:59.999Z'::timestamp)))`
      );
    });

    it('Support DATE type within range', () => {
      const clause = getFilterClauseSQL({
        filters: {
          createdAt: {
            gte: 'Tue Jun 18 2024',
            lte: 'Tue Jun 20 2024',
            op: 'and',
          },
        },
        fields: [
          {
            name: `createdAt`,
            type: `DATE`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((("kepler"."records"."createdAt" >= '2024-06-18T00:00:00.000Z'::timestamp) AND ("kepler"."records"."createdAt" <= '2024-06-20T23:59:59.999Z'::timestamp)))`
      );
    });

    it('Support either DATE types', () => {
      const clause = getFilterClauseSQL({
        filters: {
          createdAt: {
            gte: 'Tue Jun 18 2024',
            lte: 'Tue Jun 20 2024',
            // op defaults to OR
          },
        },
        fields: [
          {
            name: `createdAt`,
            type: `DATE`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((("kepler"."records"."createdAt" >= '2024-06-18T00:00:00.000Z'::timestamp) OR ("kepler"."records"."createdAt" <= '2024-06-20T23:59:59.999Z'::timestamp)))`
      );
    });

    it('Support DATE type is set', () => {
      const clause = getFilterClauseSQL({
        filters: {
          createdAt: {
            set: ``,
          },
        },
        fields: [
          {
            name: `createdAt`,
            type: `DATE`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(`(((("kepler"."records"."createdAt" IS NOT NULL))))`);
    });

    it('Support DATE type is not set', () => {
      const clause = getFilterClauseSQL({
        filters: {
          createdAt: {
            not_set: ``,
          },
        },
        fields: [
          {
            name: `createdAt`,
            type: `DATE`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(`(((("kepler"."records"."createdAt" IS NULL))))`);
    });
  });

  describe('STRING type', () => {
    it('Support STRING type equal value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          title: {
            eq: 'New Task',
          },
        },
        fields: [
          {
            name: `title`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `tasks`,
      });

      expect(clause).toBe(`(((("kepler"."tasks"."title" = 'New Task'))))`);
    });

    it('Support STRING type contains value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          title: {
            contains: 'ask',
          },
        },
        fields: [
          {
            name: `title`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `tasks`,
      });

      expect(clause).toBe(`(((("kepler"."tasks"."title" ~* '.*ask.*'))))`);
    });

    it('Support STRING type contains multiple values', () => {
      const clause = getFilterClauseSQL({
        filters: {
          title: {
            contains: ['ask', 'pepe'],
          },
        },
        fields: [
          {
            name: `title`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `tasks`,
      });

      expect(clause).toBe(
        `(((("kepler"."tasks"."title" ~* '.*ask.*|.*pepe.*'))))`
      );
    });

    it('Support STRING type contains multiple values with commas quotes', () => {
      const clause = getFilterClauseSQL({
        filters: {
          title: {
            contains: ['ask', 'Cornwell, USA'],
          },
        },
        fields: [
          {
            name: `title`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `tasks`,
      });

      expect(clause).toBe(
        `(((("kepler"."tasks"."title" ~* '.*ask.*|.*Cornwell, USA.*'))))`
      );
    });

    it('Support STRING type in multiple values with commas and quotes', () => {
      const clause = getFilterClauseSQL({
        filters: {
          title: {
            in: `staple, "maple, new york"`, // must use double quotes
          },
        },
        fields: [
          {
            name: `title`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `tasks`,
      });

      expect(clause).toBe(
        `(((("kepler"."tasks"."title" IN ('staple','maple, new york')))))`
      );
    });

    it('Support STRING type in values', () => {
      const clause = getFilterClauseSQL({
        filters: {
          title: {
            in: 'task,new',
          },
        },
        fields: [
          {
            name: `title`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `tasks`,
      });

      expect(clause).toBe(`(((("kepler"."tasks"."title" IN ('task','new')))))`);
    });

    it('Support STRING type not in values', () => {
      const clause = getFilterClauseSQL({
        filters: {
          title: {
            not_in: 'task,new',
          },
        },
        fields: [
          {
            name: `title`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `tasks`,
      });

      expect(clause).toBe(
        `(((("kepler"."tasks"."title" NOT IN ('task','new')))))`
      );
    });

    it('Support STRING type is set', () => {
      const clause = getFilterClauseSQL({
        filters: {
          title: {
            set: ``,
          },
        },
        fields: [
          {
            name: `title`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `tasks`,
      });

      expect(clause).toBe(`(((("kepler"."tasks"."title" IS NOT NULL))))`);
    });

    it('Support STRING type is not set', () => {
      const clause = getFilterClauseSQL({
        filters: {
          title: {
            not_set: ``,
          },
        },
        fields: [
          {
            name: `title`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `tasks`,
      });

      expect(clause).toBe(`(((("kepler"."tasks"."title" IS NULL))))`);
    });
  });

  describe('NUMBER type', () => {
    it('Support NUMBER type equal value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          amount: {
            eq: '30',
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(`(((("kepler"."records"."amount" = 30::bigint))))`);
    });

    it('Support NUMBER type greater than value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          amount: {
            gt: '30',
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(`(((("kepler"."records"."amount" > 30::bigint))))`);
    });

    it('Support NUMBER type less than value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          amount: {
            lt: '30',
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(`(((("kepler"."records"."amount" < 30::bigint))))`);
    });

    it('Support NUMBER type greater than or equal value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          amount: {
            gte: '30',
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(`(((("kepler"."records"."amount" >= 30::bigint))))`);
    });

    it('Support NUMBER type less than or equal value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          amount: {
            lte: '30',
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(`(((("kepler"."records"."amount" <= 30::bigint))))`);
    });

    it('Support NUMBER type within range', () => {
      const clause = getFilterClauseSQL({
        filters: {
          amount: {
            gte: '30',
            lte: '50',
            op: 'and',
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `(((("kepler"."records"."amount" >= 30::bigint)) AND (("kepler"."records"."amount" <= 50::bigint))))`
      );
    });

    it('Support either NUMBER types', () => {
      const clause = getFilterClauseSQL({
        filters: {
          amount: {
            gte: '30',
            lte: '50',
            // op defaults to OR
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `(((("kepler"."records"."amount" >= 30::bigint)) OR (("kepler"."records"."amount" <= 50::bigint))))`
      );
    });

    it('Support NUMBER type in values', () => {
      const clause = getFilterClauseSQL({
        filters: {
          amount: {
            in: '30,50',
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `(((("kepler"."records"."amount" IN (30::bigint,50::bigint)))))`
      );
    });

    it('Support NUMBER type not in values', () => {
      const clause = getFilterClauseSQL({
        filters: {
          amount: {
            not_in: '30,50',
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `(((("kepler"."records"."amount" NOT IN (30::bigint,50::bigint)))))`
      );
    });

    it('Support NUMBER type is set', () => {
      const clause = getFilterClauseSQL({
        filters: {
          amount: {
            set: ``,
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(`(((("kepler"."records"."amount" IS NOT NULL))))`);
    });

    it('Support NUMBER type is not set', () => {
      const clause = getFilterClauseSQL({
        filters: {
          amount: {
            not_set: ``,
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(`(((("kepler"."records"."amount" IS NULL))))`);
    });
  });

  describe('Combinators', () => {
    it('Support AND operation', () => {
      const clause = getFilterClauseSQL({
        filters: {
          title: {
            eq: 'New Task',
          },
          status: {
            not_eq: 'ACTIVE',
          },
        },
        fields: [
          {
            name: `title`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `tasks`,
      });

      expect(clause).toBe(
        `(((("kepler"."tasks"."title" = 'New Task'))) AND ((("kepler"."tasks"."status" != 'ACTIVE'))))`
      );
    });

    it('Support multiple values', () => {
      const clause = getFilterClauseSQL({
        filters: {
          title: {
            eq: ['task', 'new'],
          },
          status: {
            not_eq: ['ACTIVE', 'INACTIVE'],
          },
        },
        fields: [
          {
            name: `title`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `tasks`,
      });

      expect(clause).toBe(
        `(((("kepler"."tasks"."title" = 'task') OR ("kepler"."tasks"."title" = 'new'))) AND ((("kepler"."tasks"."status" != 'ACTIVE') OR ("kepler"."tasks"."status" != 'INACTIVE'))))`
      );
    });
  });

  describe('JSON fields', () => {
    it('Support JSON type equal value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          'data.firstName': {
            eq: 'John',
          },
        },
        fields: [
          {
            name: `firstName`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((((("kepler"."records"."data"->>'firstName')::text = 'John'))))`
      );
    });

    it('Support JSON type contains value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          'data.firstName': {
            contains: 'oh',
          },
        },
        fields: [
          {
            name: `firstName`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((((("kepler"."records"."data"->>'firstName')::text ~* '.*oh.*'))))`
      );
    });

    it('Support JSON type in values', () => {
      const clause = getFilterClauseSQL({
        filters: {
          'data.firstName': {
            in: 'John, Jane',
          },
        },
        fields: [
          {
            name: `firstName`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((((("kepler"."records"."data"->>'firstName')::text IN ('John','Jane')))))`
      );
    });

    it('Support JSON type not in values', () => {
      const clause = getFilterClauseSQL({
        filters: {
          'data.firstName': {
            not_in: 'John,Jane',
          },
        },
        fields: [
          {
            name: `firstName`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((((("kepler"."records"."data"->>'firstName')::text NOT IN ('John','Jane')))))`
      );
    });

    it('Support JSON type greater than value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          'data.amount': {
            gt: '30',
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((((("kepler"."records"."data"->>'amount')::bigint > 30::bigint))))`
      );
    });

    it('Support JSON type less than value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          'data.amount': {
            lt: '30',
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((((("kepler"."records"."data"->>'amount')::bigint < 30::bigint))))`
      );
    });

    it('Support JSON type is value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          'data.isPaid': {
            is: 'true',
          },
        },
        fields: [
          {
            name: `isPaid`,
            type: `CHECKBOX`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((((("kepler"."records"."data"->>'isPaid')::boolean = true::boolean))))`
      );
    });

    it('Support JSON type greater than or equal value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          'data.amount': {
            gte: '30',
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((((("kepler"."records"."data"->>'amount')::bigint >= 30::bigint))))`
      );
    });

    it('Support JSON type less than or equal value', () => {
      const clause = getFilterClauseSQL({
        filters: {
          'data.amount': {
            lte: '30',
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((((("kepler"."records"."data"->>'amount')::bigint <= 30::bigint))))`
      );
    });

    it('Support JSON type within range', () => {
      const clause = getFilterClauseSQL({
        filters: {
          'data.amount': {
            gte: '30',
            lte: '50',
            op: 'and',
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((((("kepler"."records"."data"->>'amount')::bigint >= 30::bigint)) AND ((("kepler"."records"."data"->>'amount')::bigint <= 50::bigint))))`
      );
    });

    it('Support JSON type is set', () => {
      const clause = getFilterClauseSQL({
        filters: {
          'data.amount': {
            set: ``,
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((((("kepler"."records"."data"->>'amount')::bigint IS NOT NULL))))`
      );
    });

    it('Support JSON type is not set', () => {
      const clause = getFilterClauseSQL({
        filters: {
          'data.amount': {
            not_set: ``,
          },
        },
        fields: [
          {
            name: `amount`,
            type: `CURRENCY`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `((((("kepler"."records"."data"->>'amount')::bigint IS NULL))))`
      );
    });
  });

  describe('Invalid filters', () => {
    it('Should return empty string if no parent table reference', () => {
      const clause = getFilterClauseSQL({
        filters: {
          title: {
            eq: 'New Task',
          },
        },
        fields: [
          {
            name: `title`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: '',
      });

      expect(clause).toBe('');
    });

    it('Should return empty string if no filters', () => {
      const clause = getFilterClauseSQL({
        filters: {},
        fields: [
          {
            name: `title`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: 'tasks',
      });

      expect(clause).toBe('');
    });
  });

  describe('Combined logical fields', () => {
    it('support multiple fields with OR operator', () => {
      const clause = getFilterClauseSQL({
        filters: {
          title: {
            eq: 'New Task',
          },
          status: {
            not_eq: 'ACTIVE',
          },
          'title,status': {
            op: 'or',
          },
        },
        fields: [
          {
            name: `title`,
            type: `SINGLE_LINE_TEXT`,
          },
          {
            name: `status`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `tasks`,
      });

      expect(clause).toBe(
        `((((("kepler"."tasks"."title" = 'New Task'))) OR ((("kepler"."tasks"."status" != 'ACTIVE')))))`
      );
    });

    it('support multiple fields with AND operator', () => {
      const clause = getFilterClauseSQL({
        filters: {
          title: {
            eq: 'New Task',
          },
          status: {
            not_eq: 'ACTIVE',
          },
          'title,status': {
            op: 'and',
          },
        },
        fields: [
          {
            name: `title`,
            type: `SINGLE_LINE_TEXT`,
          },
          {
            name: `status`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `tasks`,
      });

      expect(clause).toBe(
        `((((("kepler"."tasks"."title" = 'New Task'))) AND ((("kepler"."tasks"."status" != 'ACTIVE')))))`
      );
    });

    it('support mixed multiple fields with OR operator', () => {
      const clause = getFilterClauseSQL({
        filters: {
          title: {
            eq: 'New Task',
          },
          status: {
            not_eq: 'ACTIVE',
          },
          dueDate: {
            gt: 'Wed 12 Jun 2024',
          },
          'title,status': {
            op: 'or',
          },
          'title,dueDate': {
            op: 'or',
          },
        },
        fields: [
          {
            name: `title`,
            type: `SINGLE_LINE_TEXT`,
          },
          {
            name: `status`,
            type: `SINGLE_LINE_TEXT`,
          },
          {
            name: `dueDate`,
            type: `DATE`,
          },
        ],
        parentTableRef: `tasks`,
      });

      expect(clause).toBe(
        `((((("kepler"."tasks"."title" = 'New Task'))) OR ((("kepler"."tasks"."status" != 'ACTIVE')))) AND (((("kepler"."tasks"."title" = 'New Task'))) OR (("kepler"."tasks"."dueDate" > '2024-06-12T23:59:59.999Z'::timestamp))))`
      );
    });

    it('support multiple JSON fields with OR operator', () => {
      const clause = getFilterClauseSQL({
        filters: {
          'data.firstName': {
            eq: 'Dayo',
          },
          'data.lastName': {
            not_eq: 'Thor',
          },
          'data.firstName,data.lastName': {
            op: 'or',
          },
        },
        fields: [
          {
            name: `lastName`,
            type: `SINGLE_LINE_TEXT`,
          },
          {
            name: `firstName`,
            type: `SINGLE_LINE_TEXT`,
          },
        ],
        parentTableRef: `records`,
      });

      expect(clause).toBe(
        `(((((("kepler"."records"."data"->>'firstName')::text = 'Dayo'))) OR (((("kepler"."records"."data"->>'lastName')::text != 'Thor')))))`
      );
    });

    it('support multiple fields combined with regular fields', () => {
      const clause = getFilterClauseSQL({
        filters: {
          title: {
            eq: 'New Task',
          },
          status: {
            not_eq: 'ACTIVE',
          },
          dueDate: {
            gt: 'Wed 12 Jun 2024',
          },
          'title,status': {
            op: 'or',
          },
        },
        fields: [
          {
            name: `title`,
            type: `SINGLE_LINE_TEXT`,
          },
          {
            name: `status`,
            type: `SINGLE_LINE_TEXT`,
          },
          {
            name: `dueDate`,
            type: `DATE`,
          },
        ],
        parentTableRef: `tasks`,
      });

      expect(clause).toBe(
        `((((("kepler"."tasks"."title" = 'New Task'))) OR ((("kepler"."tasks"."status" != 'ACTIVE')))) AND (("kepler"."tasks"."dueDate" > '2024-06-12T23:59:59.999Z'::timestamp)))`
      );
    });
  });
});
