# node-ical
[![Build](https://github.com/jens-maus/node-ical/workflows/CI/badge.svg)](https://github.com/jens-maus/node-ical/actions)
[![NPM version](https://img.shields.io/npm/v/node-ical.svg)](https://www.npmjs.com/package/node-ical)
[![Downloads](https://img.shields.io/npm/dm/node-ical.svg)](https://www.npmjs.com/package/node-ical)
[![Contributors](https://img.shields.io/github/contributors/jens-maus/node-ical.svg)](https://github.com/jens-maus/node-ical/graphs/contributors)
[![License](https://img.shields.io/github/license/jens-maus/node-ical.svg)](https://github.com/jens-maus/node-ical/blob/master/LICENSE)
[![Donate](https://img.shields.io/badge/donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=RAQSDY9YNZVCL)
[![GitHub stars](https://img.shields.io/github/stars/jens-maus/node-ical.svg?style=social&label=Star)](https://github.com/jens-maus/node-ical/stargazers/)

A minimal iCalendar/ICS (http://tools.ietf.org/html/rfc5545) parser for Node.js. This module is a direct fork
of the ical.js module by Peter Braden (https://github.com/peterbraden/ical.js) which is primarily targeted
for parsing iCalender/ICS files in a pure JavaScript environment. (ex. within the browser itself) This node-ical
module however, primarily targets Node.js use and allows for more flexible APIs and interactions within a Node environment. (like filesystem access!)

## Install
node-ical is availble on npm:
```sh
npm install node-ical
```

## API
The API has now been broken into three sections:
 - [sync](#sync)
 - [async](#async)
 - [autodetect](#autodetect)

`sync` provides synchronous API functions.
These are easy to use but can block the event loop and are not recommended for applications that need to serve content or handle events.

`async` provides proper asynchronous support for iCal parsing.
All functions will either return a promise for `async/await` or use a callback if one is provided.

`autodetect` provides a mix of both for backwards compatibility with older node-ical applications.

All API functions are documented using JSDoc in the [node-ical.js](node-ical.js) file.
This allows for IDE hinting!

### sync
```javascript
// import ical
const ical = require('node-ical');

// use the sync function parseFile() to parse this ics file
const events = ical.sync.parseFile('example-calendar.ics');
// loop through events and log them
for (const event of Object.values(events)) {
    console.log(
        'Summary: ' + event.summary +
        '\nDescription: ' + event.description +
        '\nStart Date: ' + event.start.toISOString() +
        '\n'
    );
};

// or just parse some iCalendar data directly
const directEvents = ical.sync.parseICS(`
BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
BEGIN:VEVENT
SUMMARY:Hey look! An example event!
DTSTART;TZID=America/New_York:20130802T103400
DTEND;TZID=America/New_York:20130802T110400
LOCATION:1000 Broadway Ave.\, Brooklyn
DESCRIPTION: Do something in NY.
STATUS:CONFIRMED
UID:7014-1567468800-1567555199@peterbraden@peterbraden.co.uk
END:VEVENT
END:VCALENDAR
`);
// log the ids of these events
console.log(Object.keys(directEvents));
```

### async
```javascript
// import ical
const ical = require('node-ical');

// do stuff in an async function
;(async () => {
    // load and parse this file without blocking the event loop
    const events = await ical.async.parseFile('example-calendar.ics');

    // you can also use the async lib to download and parse iCal from the web
    const webEvents = await ical.async.fromURL('http://lanyrd.com/topics/nodejs/nodejs.ics');
    // also you can pass options to axios.get() (optional though!)
    const headerWebEvents = await ical.async.fromURL(
        'http://lanyrd.com/topics/nodejs/nodejs.ics',
        { headers: { 'User-Agent': 'API-Example / 1.0' } }
    );

    // parse iCal data without blocking the main loop for extra-large events
    const directEvents = await ical.async.parseICS(`
BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
BEGIN:VEVENT
SUMMARY:Hey look! An example event!
DTSTART;TZID=America/New_York:20130802T103400
DTEND;TZID=America/New_York:20130802T110400
DESCRIPTION: Do something in NY.
UID:7014-1567468800-1567555199@peterbraden@peterbraden.co.uk
END:VEVENT
END:VCALENDAR
    `);
})()
    .catch(console.error.bind());

// old fashioned callbacks cause why not

// parse a file with a callback
ical.async.parseFile('example-calendar.ics', function(err, data) {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(data);
});

// or a URL
ical.async.fromURL('http://lanyrd.com/topics/nodejs/nodejs.ics', function(err, data) { console.log(data); });

// or directly
ical.async.parseICS(`
BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
BEGIN:VEVENT
SUMMARY:Hey look! An example event!
DTSTART;TZID=America/New_York:20130802T103400
DTEND;TZID=America/New_York:20130802T110400
DESCRIPTION: Do something in NY.
UID:7014-1567468800-1567555199@peterbraden@peterbraden.co.uk
END:VEVENT
END:VCALENDAR
`, function(err, data) { console.log(data); });
```

Note: When using the `ical.async.*` functions in a separate async context from your main code,
errors will be thrown in that separate context. Therefore, you must wrap these function calls
in try/catch blocks to properly handle any errors. For example:

```javascript
try {
  const events = await ical.async.parseFile('calendar.ics');
  // Process events
} catch (error) {
  console.error('Failed to parse calendar:', error);
}
```

### autodetect
These are the old API examples, which still work and will be converted to the new API automatically.
Functions with callbacks provided will also have better performance over the older versions even if they use the old API.

Parses a string with ICS content in sync. This can block the event loop on big files.
```javascript
const ical = require('node-ical');
ical.parseICS(str);
```

Parses a string with ICS content in async to prevent the event loop from being blocked.
```javascript
const ical = require('node-ical');
ical.parseICS(str, function(err, data) {
    if (err) console.log(err);
    console.log(data);
});
```

Parses a string with an ICS file in sync. This can block the event loop on big files.
```javascript
const ical = require('node-ical');
const data = ical.parseFile(filename);
```

Parses a string with an ICS file in async to prevent event loop from being blocked.
```javascript
const ical = require('node-ical');
const data = ical.parseFile(filename, function(err, data) {
    if (err) console.log(err);
    console.log(data);
});
```

Reads in the specified iCal file from the URL, parses it and returns the parsed data.
```javascript
const ical = require('node-ical');
ical.fromURL(url, options, function(err, data) {
    if (err) console.log(err);
    console.log(data);
});
```

Use the axios library to get the specified URL (```opts``` gets passed on to the ```axios.get()``` call), and call the function with the result. (either an error or the data)

#### Example 1 - Print list of upcoming node conferences (see example.js) (parses the file synchronous)
```javascript
const ical = require('node-ical');
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

ical.fromURL('http://lanyrd.com/topics/nodejs/nodejs.ics', {}, function (err, data) {
    for (let k in data) {
        if (data.hasOwnProperty(k)) {
            const ev = data[k];
            if (data[k].type == 'VEVENT') {
                console.log(`${ev.summary} is in ${ev.location} on the ${ev.start.getDate()} of ${months[ev.start.getMonth()]} at ${ev.start.toLocaleTimeString('en-GB')}`);
            }
        }
    }
});
```

### Recurrence rule (RRule)

Recurrence rule will be created with timezone **if present in `DTSTART`**

To get correct date from recurrences in the recurrence rule, you need to take the original timezone and your local timezone into account

If no timezone were provided when recurrence rule were created, recurrence dates should take original start timezoneoffset and the current dates timezoneoffset into account

```javascript
const ical = require('node-ical');
const moment = require('moment-timezone');

ical.fromURL('http://lanyrd.com/topics/nodejs/nodejs.ics', {}, function (err, data) {
    for (let k in data) {
        if (!Object.prototype.hasOwnProperty.call(data, k)) continue;

        const event = data[k];
        if (event.type !== 'VEVENT' || !event.rrule) continue;
        
        const dates = event.rrule.between(new Date(2021, 0, 1, 0, 0, 0, 0), new Date(2021, 11, 31, 0, 0, 0, 0))
        if (dates.length === 0) continue;

        console.log('Summary:', event.summary);
        console.log('Original start:', event.start);
        console.log('RRule start:', `${event.rrule.origOptions.dtstart} [${event.rrule.origOptions.tzid}]`)

        dates.forEach(date => {
            let newDate
            if (event.rrule.origOptions.tzid) {
                // tzid present (calculate offset from recurrence start)
                const dateTimezone = moment.tz.zone('UTC')
                const localTimezone = moment.tz.guess()
                const tz = event.rrule.origOptions.tzid === localTimezone ? event.rrule.origOptions.tzid : localTimezone
                const timezone = moment.tz.zone(tz)
                const offset = timezone.utcOffset(date) - dateTimezone.utcOffset(date)
                newDate = moment(date).add(offset, 'minutes').toDate()
            } else {
                // tzid not present (calculate offset from original start)
                newDate = new Date(date.setHours(date.getHours() - ((event.start.getTimezoneOffset() - date.getTimezoneOffset()) / 60)))
            }
            const start = moment(newDate)
            console.log('Recurrence start:', start)
        })

        console.log('-----------------------------------------------------------------------------------------');
    }
});
```
