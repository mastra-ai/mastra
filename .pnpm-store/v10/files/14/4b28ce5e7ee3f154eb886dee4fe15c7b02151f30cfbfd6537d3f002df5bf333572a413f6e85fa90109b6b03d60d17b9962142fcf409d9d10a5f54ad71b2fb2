# ElectroDB

[![Download Count](https://img.shields.io/npm/dt/electrodb.svg)](https://www.npmjs.com/package/electrodb)
[![Coverage Status](https://coveralls.io/repos/github/tywalch/electrodb/badge.svg?branch=master)](https://coveralls.io/github/tywalch/electrodb?branch=master&kill_cache=please)
![NPM Bundle Size](https://img.shields.io/bundlephobia/min/electrodb)
[![Runkit Demo](https://img.shields.io/badge/runkit-electrodb-db4792)](https://runkit.com/tywalch/electrodb-building-queries)
[![Last Commit](https://img.shields.io/github/last-commit/tywalch/electrodb)](https://github.com/tywalch/electrodb/commits/master)
[![Issues](https://img.shields.io/github/issues/tywalch/electrodb)](https://github.com/tywalch/electrodb/issues)
[![Sponsors](https://img.shields.io/github/sponsors/tywalch)](https://github.com/tywalch)
[![Github Stars](https://img.shields.io/github/stars/tywalch/electrodb?style=social)](https://github.com/tywalch/electrodb/stargazers)

![Logo](./assets/electrodb-drk-compressed.png#gh-dark-mode-only)
![Logo](./assets/electrodb.png#gh-light-mode-only)

**_ElectroDB_** is a DynamoDB library to ease the use of having multiple entities and complex hierarchical relationships in a single DynamoDB table.

_Please submit issues/feedback or reach out on Twitter [@tinkertamper](https://twitter.com/tinkertamper)._

<a href="https://electrodb.dev/en/core-concepts/v3-migration/"><h1 align="center">ElectroDB v3 now released</h1></a>

<p align="center">Visit the <a href="https://electrodb.dev/en/core-concepts/v3-migration/">v3 migration page</a> to learn more about this new update.</p>

---

<a href="https://electrodb.dev"><h1 align="center">Documentation now found at ElectroDB.dev</h1></a>

<p align="center">ElectroDB's new website for Documentation is now live at <a href="https://electrodb.dev">electrodb.dev</a>.</p>

---

<a href="https://electrodb.fun"><h1 align="center">The NEW ElectroDB Playground</h1></a>

<p align="center">
  <a href="https://electrodb.fun"><img width="400" src="https://github.com/tywalch/electrodb/blob/master/assets/playground.jpg?raw=true"></a>
</p>

<p align="center">Try out and share ElectroDB Models, Services, and Single Table Design at <a href="https://electrodb.fun">electrodb.fun</a></p>

---

## Features

- [**Single-Table Entity Isolation**](https://electrodb.dev/en/modeling/entities/) - Entities created with **ElectroDB** will not conflict with other entities when using a single DynamoDB table.
- [**Attribute Schema Enforcement**](https://electrodb.dev/en/modeling/attributes/) - Define a schema for your entities with enforced attribute validation, defaults, types, aliases, and more.
- [**Easily Compose Hierarchical Access Patterns**](https://electrodb.dev/en/modeling/indexes/) - Plan and design hierarchical keys for your indexes to multiply your possible access patterns.
- [**Simplified Sort Key Condition Querying**](https://electrodb.dev/en/queries/query/) - Write efficient sort key queries by easily building compose keys.
- [**Simplified Filter Composition**](https://electrodb.dev/en/queries/filters/) - Easily create complex readable filters for DynamoDB queries without worrying about the implementation of `ExpressionAttributeNames`, `ExpressionAttributeValues`, and `FilterExpressions`.
- [**Simplified Condition Composition**](https://electrodb.dev/en/mutations/conditions/) - Use the same interface to casily create complex readable mutation conditions for DynamoDB queries without worrying about the implementation of `ExpressionAttributeNames`, `ExpressionAttributeValues`, and `ConditionExpressions`.
- [**Simplified Update Expression Composition**](https://electrodb.dev/en/mutations/update/) - Easily compose type safe update operations without having to format tedious `ExpressionAttributeNames`, `ExpressionAttributeValues`, and `UpdateExpressions`.
- [**Easily Query Across Entities**](https://electrodb.dev/en/core-concepts/single-table-relationships) - Define "collections" to create powerful/idiomatic queries that return multiple entities in a single request.
- [**Automatic Index Selection**](https://electrodb.dev/en/queries/find/) - Use `.find()` or `.match()` methods to dynamically and efficiently query based on defined sort key structures.
- [**Simplified Pagination API**](https://electrodb.dev/en/queries/pagination/) - ElectroDB generates url safe cursors for pagination, allows for fine grain automated pagination, and supports async iteration.
- [**Strong TypeScript Inference**](https://electrodb.dev/en/reference/typescript/) - Strong **TypeScript** support for both Entities and Services now in Beta.
- [**Query Directly via the Terminal**](https://github.com/tywalch/electrocli#query-taskapp) - Execute queries against your `Entities`, `Services`, `Models` directly from the command line.
- [**Stand Up Rest Server for Entities**](https://github.com/tywalch/electrocli#query-taskapp) - Stand up a REST Server to interact with your `Entities`, `Services`, `Models` for easier prototyping.
- [**Use with your existing tables**](https://electrodb.dev/en/recipes/use-electrodb-with-existing-table/) - ElectroDB simplifies building DocumentClient parameters, so you can use it with existing tables/data.

---

**Turn this**

```typescript
tasks
  .patch({
    team: "core",
    task: "45-662",
    project: "backend",
  })
  .set({ status: "open" })
  .add({ points: 5 })
  .append({
    comments: [
      {
        user: "janet",
        body: "This seems half-baked.",
      },
    ],
  })
  .where(({ status }, { eq }) => eq(status, "in-progress"))
  .go();
```

**Into This**

```json
{
  "UpdateExpression": "SET #status = :status_u0, #points = #points + :points_u0, #comments = list_append(#comments, :comments_u0), #updatedAt = :updatedAt_u0, #gsi1sk = :gsi1sk_u0",
  "ExpressionAttributeNames": {
    "#status": "status",
    "#points": "points",
    "#comments": "comments",
    "#updatedAt": "updatedAt",
    "#gsi1sk": "gsi1sk"
  },
  "ExpressionAttributeValues": {
    ":status0": "in-progress",
    ":status_u0": "open",
    ":points_u0": 5,
    ":comments_u0": [
      {
        "user": "janet",
        "body": "This seems half-baked."
      }
    ],
    ":updatedAt_u0": 1630977029015,
    ":gsi1sk_u0": "$assignments#tasks_1#status_open"
  },
  "TableName": "your_table_name",
  "Key": {
    "pk": "$taskapp#team_core",
    "sk": "$tasks_1#project_backend#task_45-662"
  },
  "ConditionExpression": "attribute_exists(pk) AND attribute_exists(sk) AND #status = :status0"
}
```

[![Try it out!](https://img.shields.io/badge/electrodb-try_out_this_example_›-%23f9bd00?style=for-the-badge&logo=amazondynamodb&labelColor=1a212a)](https://electrodb.fun/?#code/PQKgBAsg9gJgpgGzARwK5wE4Es4GcA0YuccYGeqCALgUQBYCG5YA7llXWAGbZwB2MXGBDAAUKKwBbAA5QMVMAG8wAUT5V2AT0IBlTADcsAY1IBfbhiiSwAIkRwjVSzABGNgNzijUPrgVUGFwRSAF5bTShUDAB9AKC4aL4GSTgPcVAwABUGXABrITUNKk1hMW9ffxz8sDC+OBZVdS0AClEwJTb2sElYRAAuDq6u-iLNAZsAvNwbfE6h-UxcLB9xgEYZua7iDEMTccnchmlpG03TWaGGKicsF1QqPAHFTfaH5KeXruLpOHG-bD4AHMNkMhuQ0FhyDABk50J9zp8Dh9QV9ND8-jcgSCUWQ4BCoTCMHCUQiUdJLAArBxUZE476-Wz-LBYi448GoSFwaFgWFweGsoaoba0lH0jEA4EC0Hsznc3n8xHsYIi0FixmYyWfdoygk8olwKXtUmg+C4IzYaQaFaDOlohk2JlYhUovxXIUqoZqgDaNigPz4M1szIAtOSoIDyLhpoRfXxg3QoAgYIGbEYEFBiMmALpgHJgcp+Q1deBcBiUGm2P38U4kouyZk0D2o9G2PioSQuTDYobGz0MQG4JuvO1-OBUbug9hwSSD9USmug3tdbySFLqWfPHE8ke2BBYPwToZTmdD5v2yRHQ+gsM-eQ4Dda0FCzCn0U7h0ahdbo1FlEuWBjDa35nuKzLAo+PYQWApiPjBtafOacBXFyACCFabraLY2G2HZdr+YAlmW1ADM0ACUNQAHxgAAIshAB0fBQCwZH4eQDAwAA8nwCCAfK8Eoqg0gwMhMBoaearYe2nYYFe7QsFcRh0OMICyUQY4keRIRUbRDwMUxLGPmxnHcbx+rwmcUrMvAAAejxAV0YZUo4D5btIuSvtwOBJuMbmqe0K6yEsDwDD6bySDYWawfheQeVwXncg6uR+WAwDAPmbEPPmViBVOYC5HAmhCFwchgNITAaAwSC4HICj5SUaCYPeUEBRmU4hTYjnUimBwRbBzqgjkSyAnU3IYSiqVZQgwSOMsvi5lNTHcCVDW8EIDDmhmQiSOWWDSMEYAjOwTVbt4U3UrN4yDVgw1rjQqlWXA1njAOWCrG5wYvaseTBg91mqW5HkTRe0g8lAYARFEYAAOI6AAkmAAASOR0MAAAK5VHT4eUFVBcWIAln2+fh-nZa1wVgD6z4yZFW5LkMMX2eNaXA6D4ORBg0Nw2AABKDBAnAwA6DV2OaLj8XPUsX1JcTWUyGTDI+q6VBCr1tPmZBP6dMocT7TBpGeKIE0AAZlVQilG2A+5gHu+VgEbgnCQ8FuPSYlqWwoz5CDYVw3HcDyJFAVDRI9+53aIBy4J0dGm4pzTKJsYXjN45ATkitgACwAKzBgAbDnABMgabJ1jjjC4635QIC6mKRUfEFQcdEAEyuzr6-o2NBtftHR7EwI39brgMmed1HRz+n38dDCut2zl6Y1dFT4wUnzY5Xv+MCATYmR0FbxDTkIjAIFwwbl-lMB0V+0E5p0NdRywdCYHAzTNEoStCucSh4uYmlUXizRv7QGwIYwwRjwNMUiXcwB0UBFAMi7ggA)
