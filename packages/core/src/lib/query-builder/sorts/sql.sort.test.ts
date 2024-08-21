import { getSortClauseSQL } from './sql';

describe('getSortClauseSQL', () => {
  it('should return an empty array if parentTableRef is not provided', () => {
    const sort = ['asc(name)', 'desc(createdAt)'];
    const clause = getSortClauseSQL({
      sort,
    });

    expect(clause).toEqual([]);
  });

  it('should return an empty array if sort is empty', () => {
    const sort: string[] = [];
    const clause = getSortClauseSQL({
      sort,
      parentTableRef: 'records',
    });

    expect(clause).toEqual([]);
  });

  it('should return an array of sort fields', () => {
    const sort = ['asc(name)', 'desc(createdAt)'];
    const clause = getSortClauseSQL({
      sort,
      parentTableRef: 'records',
    });

    expect(clause).toEqual([
      '"future"."records"."name" ASC',
      '"future"."records"."createdAt" DESC',
    ]);
  });

  it('should return an array of sort fields for JSON fields', () => {
    const sort = ['asc(data.amount)', 'desc(data.createdAt)'];
    const clause = getSortClauseSQL({
      sort,
      fields: [
        { name: 'amount', type: 'CURRENCY' },
        { name: 'createdAt', type: 'DATE' },
      ],
      parentTableRef: 'records',
    });

    expect(clause).toEqual([
      `("future"."records"."data"->>'amount')::bigint ASC`,
      `("future"."records"."data"->>'createdAt')::timestamp DESC`,
    ]);
  });
});
