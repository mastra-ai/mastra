/* eslint-disable max-depth, max-params, no-warning-comments, complexity */

const {v4: uuid} = require('uuid');
const moment = require('moment-timezone');
const rrule = require('rrule').RRule;

/** **************
 *  A tolerant, minimal icalendar parser
 *  (http://tools.ietf.org/html/rfc5545)
 *
 *  <peterbraden@peterbraden.co.uk>
 * ************* */

// Unescape Text re RFC 4.3.11
const text = function (t = '') {
  return t
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\[nN]/g, '\n')
    .replace(/\\\\/g, '\\')
    .replace(/^"(.*)"$/, '$1');
};

const parseValue = function (value) {
  if (value === 'TRUE') {
    return true;
  }

  if (value === 'FALSE') {
    return false;
  }

  const number = Number(value);
  if (!Number.isNaN(number)) {
    return number;
  }

  // Remove quotes if found
  value = value.replace(/^"(.*)"$/, '$1');

  return value;
};

const parseParameters = function (p) {
  const out = {};
  for (const element of p) {
    if (element.includes('=')) {
      const segs = element.split('=');

      out[segs[0]] = parseValue(segs.slice(1).join('='));
    }
  }

  // Sp is not defined in this scope, typo?
  // original code from peterbraden
  // return out || sp;
  return out;
};

const storeValueParameter = function (name) {
  return function (value, curr) {
    const current = curr[name];

    if (Array.isArray(current)) {
      current.push(value);
      return curr;
    }

    if (typeof current === 'undefined') {
      curr[name] = value;
    } else {
      curr[name] = [current, value];
    }

    return curr;
  };
};

const storeParameter = function (name) {
  return function (value, parameters, curr) {
    const data = parameters && parameters.length > 0 && !(parameters.length === 1 && (parameters[0] === 'CHARSET=utf-8' || parameters[0] === 'VALUE=TEXT')) ? {params: parseParameters(parameters), val: text(value)} : text(value);

    return storeValueParameter(name)(data, curr);
  };
};

const addTZ = function (dt, parameters) {
  if (dt && dt.tz) {
    // Date already has a timezone property
    return dt;
  }

  const p = parseParameters(parameters);
  if (parameters && p && dt && typeof p.TZID !== 'undefined') {
    dt.tz = p.TZID.toString();
    // Remove surrounding quotes if found at the beginning and at the end of the string
    // (Occurs when parsing Microsoft Exchange events containing TZID with Windows standard format instead IANA)
    dt.tz = dt.tz.replace(/^"(.*)"$/, '$1');
  }

  return dt;
};

let zoneTable = null;
function getIanaTZFromMS(msTZName) {
  if (!zoneTable) {
    zoneTable = require('./windowsZones.json');
  }

  // Get hash entry
  let he = zoneTable[msTZName];
  // Handle comma separated list, if we still don't have a match
  if (!he && msTZName.includes(',')) {
    // Just use the first string in name list
    const firstLocationName = msTZName.split(',')[0];
    // Loop thru the zonetable entries, save all that match
    const temporaryLookup = Object.keys(zoneTable).filter(tzEntry => {
      if (tzEntry.includes(firstLocationName)) {
        return true;
      }

      return false;
    });
    // If we found any
    if (temporaryLookup.length > 0) {
      // Use the first or only
      he = zoneTable[temporaryLookup[0]];
    }
  }

  // If found return iana name, else null
  return he ? he.iana[0] : null;
}

function getTimeZone(value) {
  let tz = value;
  let found = '';
  // If this is the custom timezone from MS Outlook
  if (tz === 'tzone://Microsoft/Custom' || tz.startsWith('Customized Time Zone') || tz.startsWith('tzone://Microsoft/')) {
    // Set it to the local timezone, because we can't tell
    tz = moment.tz.guess();
  }

  // Remove quotes if found
  tz = tz.replace(/^"(.*)"$/, '$1');

  // Watch out for windows timezones, or multiple with comma separatos
  if (tz && (tz.includes(' ') || tz.includes(','))) {
    const tz1 = getIanaTZFromMS(tz);
    if (tz1) {
      tz = tz1;
    }
  }

  // Watch out for offset timezones
  // If the conversion above didn't find any matching IANA tz
  // And offset is still present
  if (tz && tz.startsWith('(')) {
    // Extract just the offset
    const regex = /[+|-]\d*:\d*/;
    found = tz.match(regex);
    tz = null;
  }

  // Timezone not confirmed yet
  if (found === '') {
    // Lookup tz
    found = moment.tz.names().find(zone => {
      return zone === tz;
    });
  }

  return found === '' ? tz : found;
}

function isDateOnly(value, parameters) {
  const dateOnly = ((parameters && parameters.includes('VALUE=DATE') && !parameters.includes('VALUE=DATE-TIME')) || /^\d{8}$/.test(value) === true);
  return dateOnly;
}

const typeParameter = function (name) {
  // Typename is not used in this function?
  return function (value, parameters, curr) {
    const returnValue = isDateOnly(value, parameters) ? 'date' : 'date-time';
    return storeValueParameter(name)(returnValue, curr);
  };
};

const dateParameter = function (name) {
  return function (value, parameters, curr, stack) {
    // The regex from main gets confused by extra :
    const pi = parameters.indexOf('TZID=tzone');
    if (pi >= 0) {
      // Correct the parameters with the part on the value
      parameters[pi] = parameters[pi] + ':' + value.split(':')[0];
      // Get the date from the field, other code uses the value parameter
      value = value.split(':')[1];
    }

    let newDate = text(value);

    // Process 'VALUE=DATE' and EXDATE
    if (isDateOnly(value, parameters)) {
      // Just Date

      const comps = /^(\d{4})(\d{2})(\d{2}).*$/.exec(value);
      if (comps !== null) {
        // No TZ info - assume same timezone as this computer
        newDate = new Date(comps[1], Number.parseInt(comps[2], 10) - 1, comps[3]);

        newDate.dateOnly = true;

        // Store as string - worst case scenario
        return storeValueParameter(name)(newDate, curr);
      }
    }

    // Typical RFC date-time format
    const comps = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
    if (comps !== null) {
      if (comps[7] === 'Z') {
        // GMT
        newDate = new Date(
          Date.UTC(
            Number.parseInt(comps[1], 10),
            Number.parseInt(comps[2], 10) - 1,
            Number.parseInt(comps[3], 10),
            Number.parseInt(comps[4], 10),
            Number.parseInt(comps[5], 10),
            Number.parseInt(comps[6], 10)
          )
        );
        newDate.tz = 'Etc/UTC';
      } else if (parameters && parameters[0] && parameters[0].includes('TZID=') && parameters[0].split('=')[1]) {
        // Get the timezone from the parameters TZID value
        let tz = parameters[0].split('=')[1];
        let found = '';
        let offset = '';

        // If this is the custom timezone from MS Outlook
        if (tz === 'tzone://Microsoft/Custom' || tz === '(no TZ description)' || tz.startsWith('Customized Time Zone') || tz.startsWith('tzone://Microsoft/')) {
          // Set it to the local timezone, because we can't tell
          tz = moment.tz.guess();
          parameters[0] = 'TZID=' + tz;
        }

        // Remove quotes if found
        tz = tz.replace(/^"(.*)"$/, '$1');

        // Watch out for windows timezones
        if (tz && (tz.includes(' ') || tz.includes(','))) {
          const tz1 = getTimeZone(tz);
          if (tz1) {
            tz = tz1;
            // We have a confirmed timezone, don't use offset, may confuse DST/STD time
            offset = '';
            // Fix the parameters for later use
            parameters[0] = 'TZID=' + tz;
          }
        }

        // Watch out for offset timezones
        // If the conversion above didn't find any matching IANA tz
        // And offset is still present
        if (tz && tz.startsWith('(')) {
          // Extract just the offset
          const regex = /[+|-]\d*:\d*/;
          offset = tz.match(regex);
          found = offset;
          tz = null;
        }

        // Timezone not confirmed yet
        if (found === '') {
          // Lookup tz
          found = moment.tz.names().find(zone => {
            return zone === tz;
          });
        }

        // Timezone confirmed or forced to offset
        newDate = found ? moment.tz(value, 'YYYYMMDDTHHmmss' + offset, tz).toDate() : new Date(
          Number.parseInt(comps[1], 10),
          Number.parseInt(comps[2], 10) - 1,
          Number.parseInt(comps[3], 10),
          Number.parseInt(comps[4], 10),
          Number.parseInt(comps[5], 10),
          Number.parseInt(comps[6], 10)
        );

        // Make sure to correct the parameters if the TZID= is changed
        newDate = addTZ(newDate, parameters);
      } else {
        // Get the time zone from the stack
        const stackItemWithTimeZone =
          (stack || []).find(item => {
            return Object.values(item).find(subItem => subItem.type === 'VTIMEZONE');
          }) || {};
        const vTimezone =
          Object.values(stackItemWithTimeZone).find(({type}) => type === 'VTIMEZONE');

        // If the VTIMEZONE contains multiple TZIDs (against RFC), use last one
        const normalizedTzId = vTimezone ?
          (Array.isArray(vTimezone.tzid) ? vTimezone.tzid.slice(-1)[0] : vTimezone.tzid) :
          null;

        newDate = normalizedTzId && moment.tz.zone(normalizedTzId) ?
          moment.tz(value, 'YYYYMMDDTHHmmss', normalizedTzId).toDate() :
          new Date(
            Number.parseInt(comps[1], 10),
            Number.parseInt(comps[2], 10) - 1,
            Number.parseInt(comps[3], 10),
            Number.parseInt(comps[4], 10),
            Number.parseInt(comps[5], 10),
            Number.parseInt(comps[6], 10)
          );
      }
    }

    // Store as string - worst case scenario
    return storeValueParameter(name)(newDate, curr);
  };
};

const geoParameter = function (name) {
  return function (value, parameters, curr) {
    storeParameter(value, parameters, curr);
    const parts = value.split(';');
    curr[name] = {lat: Number(parts[0]), lon: Number(parts[1])};
    return curr;
  };
};

const categoriesParameter = function (name) {
  return function (value, parameters, curr) {
    storeParameter(value, parameters, curr);
    if (curr[name] === undefined) {
      curr[name] = value ? value.split(',').map(s => s.trim()) : [];
    } else if (value) {
      curr[name] = curr[name].concat(value.split(',').map(s => s.trim()));
    }

    return curr;
  };
};

// EXDATE is an entry that represents exceptions to a recurrence rule (ex: "repeat every day except on 7/4").
// The EXDATE entry itself can also contain a comma-separated list, so we make sure to parse each date out separately.
// There can also be more than one EXDATE entries in a calendar record.
// Since there can be multiple dates, we create an array of them.  The index into the array is the ISO string of the date itself, for ease of use.
// i.e. You can check if ((curr.exdate != undefined) && (curr.exdate[date iso string] != undefined)) to see if a date is an exception.
// NOTE: This specifically uses date only, and not time.  This is to avoid a few problems:
//    1. The ISO string with time wouldn't work for "floating dates" (dates without timezones).
//       ex: "20171225T060000" - this is supposed to mean 6 AM in whatever timezone you're currently in
//    2. Daylight savings time potentially affects the time you would need to look up
//    3. Some EXDATE entries in the wild seem to have times different from the recurrence rule, but are still excluded by calendar programs.  Not sure how or why.
//       These would fail any sort of sane time lookup, because the time literally doesn't match the event.  So we'll ignore time and just use date.
//       ex: DTSTART:20170814T140000Z
//             RRULE:FREQ=WEEKLY;WKST=SU;INTERVAL=2;BYDAY=MO,TU
//             EXDATE:20171219T060000
//       Even though "T060000" doesn't match or overlap "T1400000Z", it's still supposed to be excluded?  Odd. :(
// TODO: See if this causes any problems with events that recur multiple times a day.
const exdateParameter = function (name) {
  return function (value, parameters, curr) {
    curr[name] = curr[name] || [];
    const dates = value ? value.split(',').map(s => s.trim()) : [];
    for (const entry of dates) {
      const exdate = [];
      dateParameter(name)(entry, parameters, exdate);

      if (exdate[name]) {
        if (typeof exdate[name].toISOString === 'function') {
          curr[name][exdate[name].toISOString().slice(0, 10)] = exdate[name];
        } else {
          throw new TypeError('No toISOString function in exdate[name] = ' + exdate[name]);
        }
      }
    }

    return curr;
  };
};

// RECURRENCE-ID is the ID of a specific recurrence within a recurrence rule.
// TODO:  It's also possible for it to have a range, like "THISANDPRIOR", "THISANDFUTURE".  This isn't currently handled.
const recurrenceParameter = function (name) {
  return dateParameter(name);
};

const addFBType = function (fb, parameters) {
  const p = parseParameters(parameters);

  if (parameters && p) {
    fb.type = p.FBTYPE || 'BUSY';
  }

  return fb;
};

const freebusyParameter = function (name) {
  return function (value, parameters, curr) {
    const fb = addFBType({}, parameters);
    curr[name] = curr[name] || [];
    curr[name].push(fb);

    storeParameter(value, parameters, fb);

    const parts = value.split('/');

    for (const [index, name] of ['start', 'end'].entries()) {
      dateParameter(name)(parts[index], parameters, fb);
    }

    return curr;
  };
};

module.exports = {
  objectHandlers: {
    BEGIN(component, parameters, curr, stack) {
      stack.push(curr);

      return {type: component, params: parameters};
    },
    END(value, parameters, curr, stack) {
      // Original end function
      const originalEnd = function (component, parameters_, curr, stack) {
        // Prevents the need to search the root of the tree for the VCALENDAR object
        if (component === 'VCALENDAR') {
          // Scan all high level object in curr and drop all strings
          let key;
          let object;
          const highLevel = {};

          for (key in curr) {
            if (!{}.hasOwnProperty.call(curr, key)) {
              continue;
            }

            object = curr[key];
            if (typeof object === 'string') {
              highLevel[key] = object;
              delete curr[key];
            }
          }

          if (highLevel.type) {
            curr[highLevel.type.toLowerCase()] = highLevel;
          }

          return curr;
        }

        const par = stack.pop();

        if (!curr.end) { // RFC5545, 3.6.1
          // Set the end according to the datetype of event
          curr.end = (curr.datetype === 'date-time') ? new Date(curr.start.getTime()) : moment.utc(curr.start).add(1, 'days').toDate();

          // If there was a duration specified
          // see RFC5545, 3.3.6 (no year and month)
          if (curr.duration !== undefined) {
            const durationUnits =
            {
              W: 'weeks',
              D: 'days',
              H: 'hours',
              M: 'minutes',
              S: 'seconds'
            };
            // Get the list of duration elements
            const duration = curr.duration.match(/-?\d{1,10}[WDHMS]/g);

            // Use the duration to create the end value, from the start
            const startMoment = moment.utc(curr.start);
            let newEnd = startMoment;

            // Is the 1st character a negative sign?
            const indicator = curr.duration.startsWith('-') ? -1 : 1;

            for (const r of duration) {
              const unit = r.slice(-1);
              if (!durationUnits[unit]) {
                throw new Error(`Invalid duration unit: ${unit}`);
              }

              newEnd = newEnd.add(Number.parseInt(r, 10) * indicator, durationUnits[r.toString().slice(-1)]);
            }

            // End is a Date type, not moment
            curr.end = newEnd.toDate();
          }
        }

        if (curr.uid) {
          // If this is the first time we run into this UID, just save it.
          if (par[curr.uid] === undefined) {
            par[curr.uid] = curr;

            if (par.method) { // RFC5545, 3.2
              par[curr.uid].method = par.method;
            }
          } else if (curr.recurrenceid === undefined) {
            // If we have multiple ical entries with the same UID, it's either going to be a
            // modification to a recurrence (RECURRENCE-ID), and/or a significant modification
            // to the entry (SEQUENCE).

            // TODO: Look into proper sequence logic.

            // If we have the same UID as an existing record, and it *isn't* a specific recurrence ID,
            // not quite sure what the correct behaviour should be.  For now, just take the new information
            // and merge it with the old record by overwriting only the fields that appear in the new record.
            let key;
            for (key in curr) {
              if (key !== null) {
                par[curr.uid][key] = curr[key];
              }
            }
          }

          // If we have recurrence-id entries, list them as an array of recurrences keyed off of recurrence-id.
          // To use - as you're running through the dates of an rrule, you can try looking it up in the recurrences
          // array.  If it exists, then use the data from the calendar object in the recurrence instead of the parent
          // for that day.

          // NOTE:  Sometimes the RECURRENCE-ID record will show up *before* the record with the RRULE entry.  In that
          // case, what happens is that the RECURRENCE-ID record ends up becoming both the parent record and an entry
          // in the recurrences array, and then when we process the RRULE entry later it overwrites the appropriate
          // fields in the parent record.

          if (typeof curr.recurrenceid !== 'undefined') {
            // TODO:  Is there ever a case where we have to worry about overwriting an existing entry here?

            // Create a copy of the current object to save in our recurrences array.  (We *could* just do par = curr,
            // except for the case that we get the RECURRENCE-ID record before the RRULE record.  In that case, we
            // would end up with a shared reference that would cause us to overwrite *both* records at the point
            // that we try and fix up the parent record.)
            const recurrenceObject = {};
            let key;
            for (key in curr) {
              if (key !== null) {
                recurrenceObject[key] = curr[key];
              }
            }

            if (typeof recurrenceObject.recurrences !== 'undefined') {
              delete recurrenceObject.recurrences;
            }

            // If we don't have an array to store recurrences in yet, create it.
            if (par[curr.uid].recurrences === undefined) {
              par[curr.uid].recurrences = {};
            }

            // Save off our cloned recurrence object into the array, keyed by date but not time.
            // We key by date only to avoid timezone and "floating time" problems (where the time isn't associated with a timezone).
            // TODO: See if this causes a problem with events that have multiple recurrences per day.
            if (typeof curr.recurrenceid.toISOString === 'function') {
              par[curr.uid].recurrences[curr.recurrenceid.toISOString().slice(0, 10)] = recurrenceObject;
            } else { // Removed issue 56
              throw new TypeError('No toISOString function in curr.recurrenceid =' + curr.recurrenceid);
            }
          }

          // One more specific fix - in the case that an RRULE entry shows up after a RECURRENCE-ID entry,
          // let's make sure to clear the recurrenceid off the parent field.
          if (curr.uid !== '__proto__' &&
              typeof par[curr.uid].rrule !== 'undefined' &&
              typeof par[curr.uid].recurrenceid !== 'undefined') {
            delete par[curr.uid].recurrenceid;
          }
        } else if (component === 'VALARM' && (par.type === 'VEVENT' || par.type === 'VTODO')) {
          par.alarms ??= [];
          par.alarms.push(curr);
        } else {
          const id = uuid();
          par[id] = curr;

          if (par.method) { // RFC5545, 3.2
            par[id].method = par.method;
          }
        }

        return par;
      };

      // Recurrence rules are only valid for VEVENT, VTODO, and VJOURNAL.
      // More specifically, we need to filter the VCALENDAR type because we might end up with a defined rrule
      // due to the subtypes.

      if ((value === 'VEVENT' || value === 'VTODO' || value === 'VJOURNAL') && curr.rrule) {
        let rule = curr.rrule.replace('RRULE:', '');
        // Make sure the rrule starts with FREQ=
        rule = rule.slice(rule.lastIndexOf('FREQ='));
        // If no rule start date
        if (rule.includes('DTSTART') === false) {
          // This a whole day event
          if (curr.datetype === 'date') {
            // Get the timezone offset
            // The internal date is stored in UTC format
            const offset = curr.start.getTimezoneOffset();
            // Only east of gmt is a problem
            if (offset < 0) {
              // Calculate the new startdate with the offset applied, bypass RRULE/Luxon confusion
              // Make the internally stored DATE the actual date (not UTC offseted)
              // Luxon expects local time, not utc, so gets start date wrong if not adjusted
              curr.start = new Date(curr.start.getTime() + (Math.abs(offset) * 60000));
            } else {
              // Get rid of any time (shouldn't be any, but be sure)
              const x = moment(curr.start).format('MMMM/Do/YYYY');
              const comps = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(x);
              if (comps) {
                curr.start = new Date(comps[3], comps[1] - 1, comps[2]);
              }
            }
          }

          // If the date has an toISOString function
          if (curr.start && typeof curr.start.toISOString === 'function') {
            try {
              // If the original date has a TZID, add it
              if (curr.start.tz) {
                const tz = getTimeZone(curr.start.tz);
                // If a timezone is provided, rrule requires the time to be local
                // but without Z suffix (cf. RFC5545, 3.3.5)
                const adjustedTimeString = curr.start
                  .toLocaleString('sv-SE', {timeZone: tz}) // 'sv-SE' outputs 'YYYY-MM-DD' date format
                  .replace(/ /g, 'T')
                  .replace(/[-:Z]/g, '');
                rule += `;DTSTART;TZID=${tz}:${adjustedTimeString}`;
              } else {
                rule += `;DTSTART=${curr.start.toISOString().replace(/[-:]/g, '')}`;
              }

              rule = rule.replace(/\.\d{3}/, '');
            } catch (error) { // This should not happen, issue #56
              throw new Error('ERROR when trying to convert to ISOString ' + error);
            }
          } else {
            throw new Error('No toISOString function in curr.start ' + curr.start);
          }
        }

        // Make sure to catch error from rrule.fromString()
        try {
          curr.rrule = rrule.fromString(rule);
        } catch (error) {
          throw error;
        }
      }

      return originalEnd.call(this, value, parameters, curr, stack);
    },
    SUMMARY: storeParameter('summary'),
    DESCRIPTION: storeParameter('description'),
    URL: storeParameter('url'),
    UID: storeParameter('uid'),
    LOCATION: storeParameter('location'),
    DTSTART(value, parameters, curr, stack, line) {
      // If already defined, this is a duplicate for this event
      if (curr.start === undefined) {
        curr = dateParameter('start')(value, parameters, curr, stack);
        return typeParameter('datetype')(value, parameters, curr);
      }

      throw new Error('duplicate DTSTART encountered, line=' + line);
    },
    DTEND(value, parameters, curr, stack, line) {
      // If already defined, this is a duplicate for this event
      if (curr.end === undefined) {
        return dateParameter('end')(value, parameters, curr, stack);
      }

      throw new Error('duplicate DTEND encountered, line=' + line);
    },
    EXDATE: exdateParameter('exdate'),
    ' CLASS': storeParameter('class'), // Should there be a space in this property?
    TRANSP: storeParameter('transparency'),
    GEO: geoParameter('geo'),
    'PERCENT-COMPLETE': storeParameter('completion'),
    COMPLETED: dateParameter('completed'),
    CATEGORIES: categoriesParameter('categories'),
    FREEBUSY: freebusyParameter('freebusy'),
    DTSTAMP: dateParameter('dtstamp'),
    CREATED: dateParameter('created'),
    'LAST-MODIFIED': dateParameter('lastmodified'),
    'RECURRENCE-ID': recurrenceParameter('recurrenceid'),
    RRULE(value, parameters, curr, stack, line) {
      curr.rrule = line;
      return curr;
    }
  },

  handleObject(name, value, parameters, ctx, stack, line) {
    if (this.objectHandlers[name]) {
      return this.objectHandlers[name](value, parameters, ctx, stack, line);
    }

    // Handling custom properties
    if (/X-[\w-]+/.test(name) && stack.length > 0) {
      // Trimming the leading and perform storeParam
      name = name.slice(2);
      return storeParameter(name)(value, parameters, ctx, stack, line);
    }

    return storeParameter(name.toLowerCase())(value, parameters, ctx);
  },

  parseLines(lines, limit, ctx, stack, lastIndex, cb) {
    if (!cb && typeof ctx === 'function') {
      cb = ctx;
      ctx = undefined;
    }

    ctx = ctx || {};
    stack = stack || [];

    let limitCounter = 0;

    let i = lastIndex || 0;
    for (let ii = lines.length; i < ii; i++) {
      let l = lines[i];
      // Unfold : RFC#3.1
      while (lines[i + 1] && /[ \t]/.test(lines[i + 1][0])) {
        l += lines[i + 1].slice(1);
        i++;
      }

      // Remove any double quotes in any tzid statement// except around (utc+hh:mm
      if (l.includes('TZID=') && !l.includes('"(')) {
        l = l.replace(/"/g, '');
      }

      const exp = /^([\w\d-]+)((?:;[\w\d-]+=(?:(?:"[^"]*")|[^":;]+))*):(.*)$/;
      let kv = l.match(exp);

      if (kv === null) {
        // Invalid line - must have k&v
        continue;
      }

      kv = kv.slice(1);

      const value = kv[kv.length - 1];
      const name = kv[0];
      const parameters = kv[1] ? kv[1].split(';').slice(1) : [];

      ctx = this.handleObject(name, value, parameters, ctx, stack, l) || {};
      if (++limitCounter > limit) {
        break;
      }
    }

    if (i >= lines.length) {
      // Type and params are added to the list of items, get rid of them.
      delete ctx.type;
      delete ctx.params;
    }

    if (cb) {
      if (i < lines.length) {
        setImmediate(() => {
          this.parseLines(lines, limit, ctx, stack, i + 1, cb);
        });
      } else {
        setImmediate(() => {
          cb(null, ctx);
        });
      }
    } else {
      return ctx;
    }
  },

  parseICS(string, cb) {
    const lines = string.split(/\r?\n/);
    let ctx;

    if (cb) {
      // Asynchronous execution
      this.parseLines(lines, 2000, cb);
    } else {
      // Synchronous execution
      ctx = this.parseLines(lines, lines.length);
      return ctx;
    }
  }
};
