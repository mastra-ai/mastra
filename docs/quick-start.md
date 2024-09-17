<!-- this is what the quickstart should look like, when we get the Github integration working -->

# Quick Start

The quickstart shows you how to create your first integration with Kepler.

We'll create a simple integration that syncs your Github contributions to a local Postgres database.

1. Start by creating a new Next.js App Router project in TypeScript. You can initialize one quickly with `npx create-next-app --ts --eslint --src-dir --tailwind --import-alias "@/*" --app`

_(If you want to see the changes the admin app makes to your project, you may want to `git init` and `git add .` now so you can see the changes later.)_

2. From the root of the directory, install the Kepler CLI:

```bash
npm install -g @arkw/cli
```

2. Initialize your project:

```bash
npx @arkw init
```

3. Run the Kepler CLI:

```bash
npx @arkw admin
```

4. Open your browser and navigate to your admin app at http://localhost:3456/

5. Choose "Github" from the list of integrations. Click the checkmark to install the Github integration.

6. Generate a personal access token for your Github account and enter it in the admin app.

_(If you want to see the changes the admin app makes to your project, run `git diff` here.)_

7. Click the "Sync" button to sync your Github contributions.

8. Now, it's time to fetch and visualize your data.

First, install a heatmap library:

`npm i @uiw/react-heat-map`

Second, add the following to your index.ts file:

<!-- Refactor to actually fetch data -->

```ts
import HeatMap from '@uiw/react-heat-map';

const value = [
  { date: '2016/01/11', count: 2 },
  { date: '2016/01/12', count: 20 },
  { date: '2016/01/13', count: 10 },
  ...[...Array(17)].map((_, idx) => ({ date: `2016/02/${idx + 10}`, count: idx, content: '' })),
  { date: '2016/04/11', count: 2 },
  { date: '2016/05/01', count: 5 },
  { date: '2016/05/02', count: 5 },
  { date: '2016/05/04', count: 11 },
];

const Demo = () => {
  return (
    <div>
      <HeatMap value={value} weekLabels={['', 'Mon', '', 'Wed', '', 'Fri', '']} startDate={new Date('2016/01/01')} />
    </div>
  );
};
```
