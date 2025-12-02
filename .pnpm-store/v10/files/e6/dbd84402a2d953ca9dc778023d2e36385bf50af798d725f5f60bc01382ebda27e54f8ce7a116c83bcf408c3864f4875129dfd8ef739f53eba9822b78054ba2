# chalk-template

> Terminal string styling with [tagged template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates)

## Install

```sh
npm install chalk-template
```

## Usage

```js
import chalkTemplate from 'chalk-template';
import chalk from 'chalk';

const log = console.log;

log(chalkTemplate`
CPU: {red ${cpu.totalPercent}%}
RAM: {green ${ram.used / ram.total * 100}%}
DISK: {rgb(255,131,0) ${disk.used / disk.total * 100}%}
`);

log(chalk.red.bgBlack(chalkTemplate`2 + 3 = {bold ${2 + 3}}`));

const miles = 18;
const calculateFeet = miles => miles * 5280;

console.log(chalk`
	There are {bold 5280 feet} in a mile.
	In {bold ${miles} miles}, there are {green.bold ${calculateFeet(miles)} feet}.
`);


console.log(chalk`
	There are also {#FF0000 shorthand hex styles} for
	both the {#ABCDEF foreground}, {#:123456 background},
	or {#ABCDEF:123456 both}.
`);
```

## API

Blocks are delimited by an opening curly brace (`{`), a style, some content, and a closing curly brace (`}`).

Template styles are chained exactly like normal [Chalk](https://github.com/chalk/chalk) styles. The following two statements are equivalent:

```js
import chalk from 'chalk';
import chalkTemplate from 'chalk-template';

console.log(chalk.bold.rgb(10, 100, 200)('Hello!'));
console.log(chalkTemplate`{bold.rgb(10,100,200) Hello!}`);
```

Note that function styles (`rgb()`, etc.) may not contain spaces between parameters.

All interpolated values (`` chalkTemplate`${foo}` ``) are converted to strings via the `.toString()` method. All curly braces (`{` and `}`) in interpolated value strings are escaped.

## Template function

You may also use the template function as an alternative to the tagged template function.

```js
import {template} from 'chalk-template';

console.log(template('Today is {red hot}'));
```

## Related

- [chalk](https://github.com/chalk/chalk) - Terminal string styling done right
- [chalk-cli](https://github.com/chalk/chalk-cli) - Style text from the terminal

## Maintainers

- [Sindre Sorhus](https://github.com/sindresorhus)
- [Josh Junon](https://github.com/qix-)
