"use strict";

function createSlotClass(branding, construct, getters, methods, staticMethods) {
  function Class(...args) {
    if (!(this instanceof Class)) {
      throw new TypeError(internal.invalidCallingContext);
    }
    setSlots(this, construct(...args));
  }
  function bindMethod(method, methodName) {
    return Object.defineProperties((function(...args) {
      return method.call(this, getSpecificSlots(this), ...args);
    }), internal.createNameDescriptors(methodName));
  }
  function getSpecificSlots(obj) {
    const slots = getSlots(obj);
    if (!slots || slots.branding !== branding) {
      throw new TypeError(internal.invalidCallingContext);
    }
    return slots;
  }
  return Object.defineProperties(Class.prototype, {
    ...internal.createGetterDescriptors(internal.mapProps(bindMethod, getters)),
    ...internal.createPropDescriptors(internal.mapProps(bindMethod, methods)),
    ...internal.createStringTagDescriptors("Temporal." + branding)
  }), Object.defineProperties(Class, {
    ...internal.createPropDescriptors(staticMethods),
    ...internal.createNameDescriptors(branding)
  }), [ Class, slots => {
    const instance = Object.create(Class.prototype);
    return setSlots(instance, slots), instance;
  }, getSpecificSlots ];
}

function createProtocolValidator(propNames) {
  return propNames = propNames.concat("id").sort(), obj => {
    if (!internal.hasAllPropsByName(obj, propNames)) {
      throw new TypeError(internal.invalidProtocol);
    }
    return obj;
  };
}

function rejectInvalidBag(bag) {
  if (getSlots(bag) || void 0 !== bag.calendar || void 0 !== bag.timeZone) {
    throw new TypeError(internal.invalidBag);
  }
  return bag;
}

function createCalendarFieldMethods(methodNameMap, alsoAccept) {
  const methods = {};
  for (const methodName in methodNameMap) {
    methods[methodName] = ({native: native}, dateArg) => {
      const argSlots = getSlots(dateArg) || {}, {branding: branding} = argSlots, refinedSlots = branding === internal.PlainDateBranding || alsoAccept.includes(branding) ? argSlots : toPlainDateSlots(dateArg);
      return native[methodName](refinedSlots);
    };
  }
  return methods;
}

function createCalendarGetters(methodNameMap) {
  const methods = {};
  for (const methodName in methodNameMap) {
    methods[methodName] = slots => {
      const {calendar: calendar} = slots;
      return (calendarSlot = calendar, "string" == typeof calendarSlot ? internal.createNativeStandardOps(calendarSlot) : (calendarProtocol = calendarSlot, 
      Object.assign(Object.create(adapterSimpleOps), {
        calendarProtocol: calendarProtocol
      })))[methodName](slots);
      var calendarSlot, calendarProtocol;
    };
  }
  return methods;
}

function neverValueOf() {
  throw new TypeError(internal.forbiddenValueOf);
}

function createCalendarFromSlots({calendar: calendar}) {
  return "string" == typeof calendar ? new Calendar(calendar) : calendar;
}

function toPlainMonthDaySlots(arg, options) {
  if (options = internal.copyOptions(options), internal.isObjectLike(arg)) {
    const slots = getSlots(arg);
    if (slots && slots.branding === internal.PlainMonthDayBranding) {
      return internal.refineOverflowOptions(options), slots;
    }
    const calendarMaybe = extractCalendarSlotFromBag(arg), calendar = calendarMaybe || internal.isoCalendarId;
    return internal.refinePlainMonthDayBag(createMonthDayRefineOps(calendar), !calendarMaybe, arg, options);
  }
  const res = internal.parsePlainMonthDay(internal.createNativeStandardOps, arg);
  return internal.refineOverflowOptions(options), res;
}

function getOffsetNanosecondsForAdapter(timeZoneProtocol, getOffsetNanosecondsFor, epochNano) {
  return offsetNano = getOffsetNanosecondsFor.call(timeZoneProtocol, createInstant(internal.createInstantSlots(epochNano))), 
  internal.validateTimeZoneOffset(internal.requireInteger(offsetNano));
  var offsetNano;
}

function createAdapterOps(timeZoneProtocol, adapterFuncs = timeZoneAdapters) {
  const keys = Object.keys(adapterFuncs).sort(), boundFuncs = {};
  for (const key of keys) {
    boundFuncs[key] = internal.bindArgs(adapterFuncs[key], timeZoneProtocol, internal.requireFunction(timeZoneProtocol[key]));
  }
  return boundFuncs;
}

function createTimeZoneOps(timeZoneSlot, adapterFuncs) {
  return "string" == typeof timeZoneSlot ? internal.queryNativeTimeZone(timeZoneSlot) : createAdapterOps(timeZoneSlot, adapterFuncs);
}

function createTimeZoneOffsetOps(timeZoneSlot) {
  return createTimeZoneOps(timeZoneSlot, simpleTimeZoneAdapters);
}

function toInstantSlots(arg) {
  if (internal.isObjectLike(arg)) {
    const slots = getSlots(arg);
    if (slots) {
      switch (slots.branding) {
       case internal.InstantBranding:
        return slots;

       case internal.ZonedDateTimeBranding:
        return internal.createInstantSlots(slots.epochNanoseconds);
      }
    }
  }
  return internal.parseInstant(arg);
}

function getImplTransition(direction, impl, instantArg) {
  const epochNano = impl.getTransition(toInstantSlots(instantArg).epochNanoseconds, direction);
  return epochNano ? createInstant(internal.createInstantSlots(epochNano)) : null;
}

function refineTimeZoneSlot(arg) {
  return internal.isObjectLike(arg) ? (getSlots(arg) || {}).timeZone || validateTimeZoneProtocol(arg) : (arg => internal.resolveTimeZoneId(internal.parseTimeZoneId(internal.requireString(arg))))(arg);
}

function toPlainTimeSlots(arg, options) {
  if (internal.isObjectLike(arg)) {
    const slots = getSlots(arg) || {};
    switch (slots.branding) {
     case internal.PlainTimeBranding:
      return internal.refineOverflowOptions(options), slots;

     case internal.PlainDateTimeBranding:
      return internal.refineOverflowOptions(options), internal.createPlainTimeSlots(slots);

     case internal.ZonedDateTimeBranding:
      return internal.refineOverflowOptions(options), internal.zonedDateTimeToPlainTime(createTimeZoneOffsetOps, slots);
    }
    return internal.refinePlainTimeBag(arg, options);
  }
  return internal.refineOverflowOptions(options), internal.parsePlainTime(arg);
}

function optionalToPlainTimeFields(timeArg) {
  return void 0 === timeArg ? void 0 : toPlainTimeSlots(timeArg);
}

function toPlainYearMonthSlots(arg, options) {
  if (options = internal.copyOptions(options), internal.isObjectLike(arg)) {
    const slots = getSlots(arg);
    return slots && slots.branding === internal.PlainYearMonthBranding ? (internal.refineOverflowOptions(options), 
    slots) : internal.refinePlainYearMonthBag(createYearMonthRefineOps(getCalendarSlotFromBag(arg)), arg, options);
  }
  const res = internal.parsePlainYearMonth(internal.createNativeStandardOps, arg);
  return internal.refineOverflowOptions(options), res;
}

function toPlainDateTimeSlots(arg, options) {
  if (options = internal.copyOptions(options), internal.isObjectLike(arg)) {
    const slots = getSlots(arg) || {};
    switch (slots.branding) {
     case internal.PlainDateTimeBranding:
      return internal.refineOverflowOptions(options), slots;

     case internal.PlainDateBranding:
      return internal.refineOverflowOptions(options), internal.createPlainDateTimeSlots({
        ...slots,
        ...internal.isoTimeFieldDefaults
      });

     case internal.ZonedDateTimeBranding:
      return internal.refineOverflowOptions(options), internal.zonedDateTimeToPlainDateTime(createTimeZoneOffsetOps, slots);
    }
    return internal.refinePlainDateTimeBag(createDateRefineOps(getCalendarSlotFromBag(arg)), arg, options);
  }
  const res = internal.parsePlainDateTime(arg);
  return internal.refineOverflowOptions(options), res;
}

function toPlainDateSlots(arg, options) {
  if (options = internal.copyOptions(options), internal.isObjectLike(arg)) {
    const slots = getSlots(arg) || {};
    switch (slots.branding) {
     case internal.PlainDateBranding:
      return internal.refineOverflowOptions(options), slots;

     case internal.PlainDateTimeBranding:
      return internal.refineOverflowOptions(options), internal.createPlainDateSlots(slots);

     case internal.ZonedDateTimeBranding:
      return internal.refineOverflowOptions(options), internal.zonedDateTimeToPlainDate(createTimeZoneOffsetOps, slots);
    }
    return internal.refinePlainDateBag(createDateRefineOps(getCalendarSlotFromBag(arg)), arg, options);
  }
  const res = internal.parsePlainDate(arg);
  return internal.refineOverflowOptions(options), res;
}

function dayAdapter(calendarProtocol, dayMethod, isoFields) {
  return internal.requirePositiveInteger(dayMethod.call(calendarProtocol, createPlainDate(internal.createPlainDateSlots(isoFields, calendarProtocol))));
}

function createCompoundOpsCreator(adapterFuncs) {
  return calendarSlot => "string" == typeof calendarSlot ? internal.createNativeStandardOps(calendarSlot) : ((calendarProtocol, adapterFuncs) => {
    const keys = Object.keys(adapterFuncs).sort(), boundFuncs = {};
    for (const key of keys) {
      boundFuncs[key] = internal.bindArgs(adapterFuncs[key], calendarProtocol, calendarProtocol[key]);
    }
    return boundFuncs;
  })(calendarSlot, adapterFuncs);
}

function toDurationSlots(arg) {
  if (internal.isObjectLike(arg)) {
    const slots = getSlots(arg);
    return slots && slots.branding === internal.DurationBranding ? slots : internal.refineDurationBag(arg);
  }
  return internal.parseDuration(arg);
}

function refinePublicRelativeTo(relativeTo) {
  if (void 0 !== relativeTo) {
    if (internal.isObjectLike(relativeTo)) {
      const slots = getSlots(relativeTo) || {};
      switch (slots.branding) {
       case internal.ZonedDateTimeBranding:
       case internal.PlainDateBranding:
        return slots;

       case internal.PlainDateTimeBranding:
        return internal.createPlainDateSlots(slots);
      }
      const calendar = getCalendarSlotFromBag(relativeTo);
      return {
        ...internal.refineMaybeZonedDateTimeBag(refineTimeZoneSlot, createTimeZoneOps, createDateRefineOps(calendar), relativeTo),
        calendar: calendar
      };
    }
    return internal.parseRelativeToSlots(relativeTo);
  }
}

function getCalendarSlotFromBag(bag) {
  return extractCalendarSlotFromBag(bag) || internal.isoCalendarId;
}

function extractCalendarSlotFromBag(bag) {
  const {calendar: calendar} = bag;
  if (void 0 !== calendar) {
    return refineCalendarSlot(calendar);
  }
}

function refineCalendarSlot(arg) {
  return internal.isObjectLike(arg) ? (getSlots(arg) || {}).calendar || validateCalendarProtocol(arg) : (arg => internal.resolveCalendarId(internal.parseCalendarId(internal.requireString(arg))))(arg);
}

function toZonedDateTimeSlots(arg, options) {
  if (options = internal.copyOptions(options), internal.isObjectLike(arg)) {
    const slots = getSlots(arg);
    if (slots && slots.branding === internal.ZonedDateTimeBranding) {
      return internal.refineZonedFieldOptions(options), slots;
    }
    const calendarSlot = getCalendarSlotFromBag(arg);
    return internal.refineZonedDateTimeBag(refineTimeZoneSlot, createTimeZoneOps, createDateRefineOps(calendarSlot), calendarSlot, arg, options);
  }
  return internal.parseZonedDateTime(arg, options);
}

function adaptDateMethods(methods) {
  return internal.mapProps((method => slots => method(slotsToIso(slots))), methods);
}

function slotsToIso(slots) {
  return internal.zonedEpochSlotsToIso(slots, createTimeZoneOffsetOps);
}

function createFormatMethod(methodName) {
  return function(...formattables) {
    const prepFormat = internalsMap.get(this), [format, ...rawFormattables] = prepFormat(...formattables);
    return format[methodName](...rawFormattables);
  };
}

function createProxiedMethod(methodName) {
  return function(...args) {
    return internalsMap.get(this).rawFormat[methodName](...args);
  };
}

function createFormatPrepperForBranding(branding) {
  const config = classFormatConfigs[branding];
  if (!config) {
    throw new TypeError(internal.invalidFormatType(branding));
  }
  return internal.createFormatPrepper(config, internal.memoize(internal.createFormatForPrep));
}

var internal = require("./internal.cjs");

const classFormatConfigs = {
  Instant: internal.instantConfig,
  PlainDateTime: internal.dateTimeConfig,
  PlainDate: internal.dateConfig,
  PlainTime: internal.timeConfig,
  PlainYearMonth: internal.yearMonthConfig,
  PlainMonthDay: internal.monthDayConfig
}, prepInstantFormat = internal.createFormatPrepper(internal.instantConfig), prepZonedDateTimeFormat = internal.createFormatPrepper(internal.zonedConfig), prepPlainDateTimeFormat = internal.createFormatPrepper(internal.dateTimeConfig), prepPlainDateFormat = internal.createFormatPrepper(internal.dateConfig), prepPlainTimeFormat = internal.createFormatPrepper(internal.timeConfig), prepPlainYearMonthFormat = internal.createFormatPrepper(internal.yearMonthConfig), prepPlainMonthDayFormat = internal.createFormatPrepper(internal.monthDayConfig), yearMonthOnlyRefiners = {
  era: internal.requireStringOrUndefined,
  eraYear: internal.requireIntegerOrUndefined,
  year: internal.requireInteger,
  month: internal.requirePositiveInteger,
  daysInMonth: internal.requirePositiveInteger,
  daysInYear: internal.requirePositiveInteger,
  inLeapYear: internal.requireBoolean,
  monthsInYear: internal.requirePositiveInteger
}, monthOnlyRefiners = {
  monthCode: internal.requireString
}, dayOnlyRefiners = {
  day: internal.requirePositiveInteger
}, dateOnlyRefiners = {
  dayOfWeek: internal.requirePositiveInteger,
  dayOfYear: internal.requirePositiveInteger,
  weekOfYear: internal.requirePositiveIntegerOrUndefined,
  yearOfWeek: internal.requireIntegerOrUndefined,
  daysInWeek: internal.requirePositiveInteger
}, dateRefiners = {
  ...yearMonthOnlyRefiners,
  ...monthOnlyRefiners,
  ...dayOnlyRefiners,
  ...dateOnlyRefiners
}, slotsMap = new WeakMap, getSlots = slotsMap.get.bind(slotsMap), setSlots = slotsMap.set.bind(slotsMap), calendarFieldMethods = {
  ...createCalendarFieldMethods(yearMonthOnlyRefiners, [ internal.PlainYearMonthBranding ]),
  ...createCalendarFieldMethods(dateOnlyRefiners, []),
  ...createCalendarFieldMethods(monthOnlyRefiners, [ internal.PlainYearMonthBranding, internal.PlainMonthDayBranding ]),
  ...createCalendarFieldMethods(dayOnlyRefiners, [ internal.PlainMonthDayBranding ])
}, dateGetters = createCalendarGetters(dateRefiners), yearMonthGetters = createCalendarGetters({
  ...yearMonthOnlyRefiners,
  ...monthOnlyRefiners
}), monthDayGetters = createCalendarGetters({
  ...monthOnlyRefiners,
  ...dayOnlyRefiners
}), calendarIdGetters = {
  calendarId: slots => internal.getId(slots.calendar)
}, adapterSimpleOps = internal.mapProps(((refiner, methodName) => function(isoFields) {
  const {calendarProtocol: calendarProtocol} = this;
  return refiner(calendarProtocol[methodName](createPlainDate(internal.createPlainDateSlots(isoFields, calendarProtocol))));
}), dateRefiners), durationGetters = internal.mapPropNames((propName => slots => slots[propName]), internal.durationFieldNamesAsc.concat("sign")), timeGetters = internal.mapPropNames(((_name, i) => slots => slots[internal.isoTimeFieldNamesAsc[i]]), internal.timeFieldNamesAsc), epochGetters = {
  epochSeconds: internal.getEpochSec,
  epochMilliseconds: internal.getEpochMilli,
  epochMicroseconds: internal.getEpochMicro,
  epochNanoseconds: internal.getEpochNano
}, removeBranding = internal.bindArgs(internal.excludePropsByName, new Set([ "branding" ])), [PlainMonthDay, createPlainMonthDay, getPlainMonthDaySlots] = createSlotClass(internal.PlainMonthDayBranding, internal.bindArgs(internal.constructPlainMonthDaySlots, refineCalendarSlot), {
  ...calendarIdGetters,
  ...monthDayGetters
}, {
  getISOFields: removeBranding,
  getCalendar: createCalendarFromSlots,
  with(slots, mod, options) {
    return createPlainMonthDay(internal.plainMonthDayWithFields(createMonthDayModOps, slots, this, rejectInvalidBag(mod), options));
  },
  equals: (slots, otherArg) => internal.plainMonthDaysEqual(slots, toPlainMonthDaySlots(otherArg)),
  toPlainDate(slots, bag) {
    return createPlainDate(internal.plainMonthDayToPlainDate(createDateModOps, slots, this, bag));
  },
  toLocaleString(slots, locales, options) {
    const [format, epochMilli] = prepPlainMonthDayFormat(locales, options, slots);
    return format.format(epochMilli);
  },
  toString: internal.formatPlainMonthDayIso,
  toJSON: slots => internal.formatPlainMonthDayIso(slots),
  valueOf: neverValueOf
}, {
  from: (arg, options) => createPlainMonthDay(toPlainMonthDaySlots(arg, options))
}), timeZoneAdapters = {
  getOffsetNanosecondsFor: getOffsetNanosecondsForAdapter,
  getPossibleInstantsFor(timeZoneProtocol, getPossibleInstantsFor, isoFields) {
    const epochNanos = [ ...getPossibleInstantsFor.call(timeZoneProtocol, createPlainDateTime(internal.createPlainDateTimeSlots(isoFields, internal.isoCalendarId))) ].map((instant => getInstantSlots(instant).epochNanoseconds)), epochNanoLen = epochNanos.length;
    return epochNanoLen > 1 && (epochNanos.sort(internal.compareBigNanos), internal.validateTimeZoneGap(internal.bigNanoToNumber(internal.diffBigNanos(epochNanos[0], epochNanos[epochNanoLen - 1])))), 
    epochNanos;
  }
}, simpleTimeZoneAdapters = {
  getOffsetNanosecondsFor: getOffsetNanosecondsForAdapter
}, [Instant, createInstant, getInstantSlots] = createSlotClass(internal.InstantBranding, internal.constructInstantSlots, epochGetters, {
  add: (slots, durationArg) => createInstant(internal.moveInstant(0, slots, toDurationSlots(durationArg))),
  subtract: (slots, durationArg) => createInstant(internal.moveInstant(1, slots, toDurationSlots(durationArg))),
  until: (slots, otherArg, options) => createDuration(internal.diffInstants(0, slots, toInstantSlots(otherArg), options)),
  since: (slots, otherArg, options) => createDuration(internal.diffInstants(1, slots, toInstantSlots(otherArg), options)),
  round: (slots, options) => createInstant(internal.roundInstant(slots, options)),
  equals: (slots, otherArg) => internal.instantsEqual(slots, toInstantSlots(otherArg)),
  toZonedDateTime(slots, options) {
    const refinedObj = internal.requireObjectLike(options);
    return createZonedDateTime(internal.instantToZonedDateTime(slots, refineTimeZoneSlot(refinedObj.timeZone), refineCalendarSlot(refinedObj.calendar)));
  },
  toZonedDateTimeISO: (slots, timeZoneArg) => createZonedDateTime(internal.instantToZonedDateTime(slots, refineTimeZoneSlot(timeZoneArg))),
  toLocaleString(slots, locales, options) {
    const [format, epochMilli] = prepInstantFormat(locales, options, slots);
    return format.format(epochMilli);
  },
  toString: (slots, options) => internal.formatInstantIso(refineTimeZoneSlot, createTimeZoneOffsetOps, slots, options),
  toJSON: slots => internal.formatInstantIso(refineTimeZoneSlot, createTimeZoneOffsetOps, slots),
  valueOf: neverValueOf
}, {
  from: arg => createInstant(toInstantSlots(arg)),
  fromEpochSeconds: epochSec => createInstant(internal.epochSecToInstant(epochSec)),
  fromEpochMilliseconds: epochMilli => createInstant(internal.epochMilliToInstant(epochMilli)),
  fromEpochMicroseconds: epochMicro => createInstant(internal.epochMicroToInstant(epochMicro)),
  fromEpochNanoseconds: epochNano => createInstant(internal.epochNanoToInstant(epochNano)),
  compare: (a, b) => internal.compareInstants(toInstantSlots(a), toInstantSlots(b))
}), [TimeZone, createTimeZone] = createSlotClass("TimeZone", (id => {
  const slotId = internal.refineTimeZoneId(id);
  return {
    branding: "TimeZone",
    id: slotId,
    native: internal.queryNativeTimeZone(slotId)
  };
}), {
  id: slots => slots.id
}, {
  getPossibleInstantsFor: ({native: native}, plainDateTimeArg) => native.getPossibleInstantsFor(toPlainDateTimeSlots(plainDateTimeArg)).map((epochNano => createInstant(internal.createInstantSlots(epochNano)))),
  getOffsetNanosecondsFor: ({native: native}, instantArg) => native.getOffsetNanosecondsFor(toInstantSlots(instantArg).epochNanoseconds),
  getOffsetStringFor(_slots, instantArg) {
    const epochNano = toInstantSlots(instantArg).epochNanoseconds, offsetNano = createAdapterOps(this, simpleTimeZoneAdapters).getOffsetNanosecondsFor(epochNano);
    return internal.formatOffsetNano(offsetNano);
  },
  getPlainDateTimeFor(_slots, instantArg, calendarArg = internal.isoCalendarId) {
    const epochNano = toInstantSlots(instantArg).epochNanoseconds, offsetNano = createAdapterOps(this, simpleTimeZoneAdapters).getOffsetNanosecondsFor(epochNano);
    return createPlainDateTime(internal.createPlainDateTimeSlots(internal.epochNanoToIso(epochNano, offsetNano), refineCalendarSlot(calendarArg)));
  },
  getInstantFor(_slots, plainDateTimeArg, options) {
    const isoFields = toPlainDateTimeSlots(plainDateTimeArg), epochDisambig = internal.refineEpochDisambigOptions(options), calendarOps = createAdapterOps(this);
    return createInstant(internal.createInstantSlots(internal.getSingleInstantFor(calendarOps, isoFields, epochDisambig)));
  },
  getNextTransition: ({native: native}, instantArg) => getImplTransition(1, native, instantArg),
  getPreviousTransition: ({native: native}, instantArg) => getImplTransition(-1, native, instantArg),
  equals(_slots, otherArg) {
    return !!internal.isTimeZoneSlotsEqual(this, refineTimeZoneSlot(otherArg));
  },
  toString: slots => slots.id,
  toJSON: slots => slots.id
}, {
  from(arg) {
    const timeZoneSlot = refineTimeZoneSlot(arg);
    return "string" == typeof timeZoneSlot ? new TimeZone(timeZoneSlot) : timeZoneSlot;
  }
}), validateTimeZoneProtocol = createProtocolValidator(Object.keys(timeZoneAdapters)), [PlainTime, createPlainTime] = createSlotClass(internal.PlainTimeBranding, internal.constructPlainTimeSlots, timeGetters, {
  getISOFields: removeBranding,
  with(_slots, mod, options) {
    return createPlainTime(internal.plainTimeWithFields(this, rejectInvalidBag(mod), options));
  },
  add: (slots, durationArg) => createPlainTime(internal.movePlainTime(0, slots, toDurationSlots(durationArg))),
  subtract: (slots, durationArg) => createPlainTime(internal.movePlainTime(1, slots, toDurationSlots(durationArg))),
  until: (slots, otherArg, options) => createDuration(internal.diffPlainTimes(0, slots, toPlainTimeSlots(otherArg), options)),
  since: (slots, otherArg, options) => createDuration(internal.diffPlainTimes(1, slots, toPlainTimeSlots(otherArg), options)),
  round: (slots, options) => createPlainTime(internal.roundPlainTime(slots, options)),
  equals: (slots, other) => internal.plainTimesEqual(slots, toPlainTimeSlots(other)),
  toZonedDateTime: (slots, options) => createZonedDateTime(internal.plainTimeToZonedDateTime(refineTimeZoneSlot, toPlainDateSlots, createTimeZoneOps, slots, options)),
  toPlainDateTime: (slots, plainDateArg) => createPlainDateTime(internal.plainTimeToPlainDateTime(slots, toPlainDateSlots(plainDateArg))),
  toLocaleString(slots, locales, options) {
    const [format, epochMilli] = prepPlainTimeFormat(locales, options, slots);
    return format.format(epochMilli);
  },
  toString: internal.formatPlainTimeIso,
  toJSON: slots => internal.formatPlainTimeIso(slots),
  valueOf: neverValueOf
}, {
  from: (arg, options) => createPlainTime(toPlainTimeSlots(arg, options)),
  compare: (arg0, arg1) => internal.compareIsoTimeFields(toPlainTimeSlots(arg0), toPlainTimeSlots(arg1))
}), [PlainYearMonth, createPlainYearMonth, getPlainYearMonthSlots] = createSlotClass(internal.PlainYearMonthBranding, internal.bindArgs(internal.constructPlainYearMonthSlots, refineCalendarSlot), {
  ...calendarIdGetters,
  ...yearMonthGetters
}, {
  getISOFields: removeBranding,
  getCalendar: createCalendarFromSlots,
  with(slots, mod, options) {
    return createPlainYearMonth(internal.plainYearMonthWithFields(createYearMonthModOps, slots, this, rejectInvalidBag(mod), options));
  },
  add: (slots, durationArg, options) => createPlainYearMonth(internal.movePlainYearMonth(createYearMonthMoveOps, 0, slots, toDurationSlots(durationArg), options)),
  subtract: (slots, durationArg, options) => createPlainYearMonth(internal.movePlainYearMonth(createYearMonthMoveOps, 1, slots, toDurationSlots(durationArg), options)),
  until: (slots, otherArg, options) => createDuration(internal.diffPlainYearMonth(createYearMonthDiffOps, 0, slots, toPlainYearMonthSlots(otherArg), options)),
  since: (slots, otherArg, options) => createDuration(internal.diffPlainYearMonth(createYearMonthDiffOps, 1, slots, toPlainYearMonthSlots(otherArg), options)),
  equals: (slots, otherArg) => internal.plainYearMonthsEqual(slots, toPlainYearMonthSlots(otherArg)),
  toPlainDate(slots, bag) {
    return createPlainDate(internal.plainYearMonthToPlainDate(createDateModOps, slots, this, bag));
  },
  toLocaleString(slots, locales, options) {
    const [format, epochMilli] = prepPlainYearMonthFormat(locales, options, slots);
    return format.format(epochMilli);
  },
  toString: internal.formatPlainYearMonthIso,
  toJSON: slots => internal.formatPlainYearMonthIso(slots),
  valueOf: neverValueOf
}, {
  from: (arg, options) => createPlainYearMonth(toPlainYearMonthSlots(arg, options)),
  compare: (arg0, arg1) => internal.compareIsoDateFields(toPlainYearMonthSlots(arg0), toPlainYearMonthSlots(arg1))
}), [PlainDateTime, createPlainDateTime] = createSlotClass(internal.PlainDateTimeBranding, internal.bindArgs(internal.constructPlainDateTimeSlots, refineCalendarSlot), {
  ...calendarIdGetters,
  ...dateGetters,
  ...timeGetters
}, {
  getISOFields: removeBranding,
  getCalendar: createCalendarFromSlots,
  with(slots, mod, options) {
    return createPlainDateTime(internal.plainDateTimeWithFields(createDateModOps, slots, this, rejectInvalidBag(mod), options));
  },
  withCalendar: (slots, calendarArg) => createPlainDateTime(internal.slotsWithCalendar(slots, refineCalendarSlot(calendarArg))),
  withPlainDate: (slots, plainDateArg) => createPlainDateTime(internal.plainDateTimeWithPlainDate(slots, toPlainDateSlots(plainDateArg))),
  withPlainTime: (slots, plainTimeArg) => createPlainDateTime(internal.plainDateTimeWithPlainTime(slots, optionalToPlainTimeFields(plainTimeArg))),
  add: (slots, durationArg, options) => createPlainDateTime(internal.movePlainDateTime(createMoveOps, 0, slots, toDurationSlots(durationArg), options)),
  subtract: (slots, durationArg, options) => createPlainDateTime(internal.movePlainDateTime(createMoveOps, 1, slots, toDurationSlots(durationArg), options)),
  until: (slots, otherArg, options) => createDuration(internal.diffPlainDateTimes(createDiffOps, 0, slots, toPlainDateTimeSlots(otherArg), options)),
  since: (slots, otherArg, options) => createDuration(internal.diffPlainDateTimes(createDiffOps, 1, slots, toPlainDateTimeSlots(otherArg), options)),
  round: (slots, options) => createPlainDateTime(internal.roundPlainDateTime(slots, options)),
  equals: (slots, otherArg) => internal.plainDateTimesEqual(slots, toPlainDateTimeSlots(otherArg)),
  toZonedDateTime: (slots, timeZoneArg, options) => createZonedDateTime(internal.plainDateTimeToZonedDateTime(createTimeZoneOps, slots, refineTimeZoneSlot(timeZoneArg), options)),
  toPlainDate: slots => createPlainDate(internal.createPlainDateSlots(slots)),
  toPlainTime: slots => createPlainTime(internal.createPlainTimeSlots(slots)),
  toPlainYearMonth(slots) {
    return createPlainYearMonth(internal.plainDateTimeToPlainYearMonth(createYearMonthRefineOps, slots, this));
  },
  toPlainMonthDay(slots) {
    return createPlainMonthDay(internal.plainDateTimeToPlainMonthDay(createMonthDayRefineOps, slots, this));
  },
  toLocaleString(slots, locales, options) {
    const [format, epochMilli] = prepPlainDateTimeFormat(locales, options, slots);
    return format.format(epochMilli);
  },
  toString: internal.formatPlainDateTimeIso,
  toJSON: slots => internal.formatPlainDateTimeIso(slots),
  valueOf: neverValueOf
}, {
  from: (arg, options) => createPlainDateTime(toPlainDateTimeSlots(arg, options)),
  compare: (arg0, arg1) => internal.compareIsoDateTimeFields(toPlainDateTimeSlots(arg0), toPlainDateTimeSlots(arg1))
}), [PlainDate, createPlainDate, getPlainDateSlots] = createSlotClass(internal.PlainDateBranding, internal.bindArgs(internal.constructPlainDateSlots, refineCalendarSlot), {
  ...calendarIdGetters,
  ...dateGetters
}, {
  getISOFields: removeBranding,
  getCalendar: createCalendarFromSlots,
  with(slots, mod, options) {
    return createPlainDate(internal.plainDateWithFields(createDateModOps, slots, this, rejectInvalidBag(mod), options));
  },
  withCalendar: (slots, calendarArg) => createPlainDate(internal.slotsWithCalendar(slots, refineCalendarSlot(calendarArg))),
  add: (slots, durationArg, options) => createPlainDate(internal.movePlainDate(createMoveOps, 0, slots, toDurationSlots(durationArg), options)),
  subtract: (slots, durationArg, options) => createPlainDate(internal.movePlainDate(createMoveOps, 1, slots, toDurationSlots(durationArg), options)),
  until: (slots, otherArg, options) => createDuration(internal.diffPlainDates(createDiffOps, 0, slots, toPlainDateSlots(otherArg), options)),
  since: (slots, otherArg, options) => createDuration(internal.diffPlainDates(createDiffOps, 1, slots, toPlainDateSlots(otherArg), options)),
  equals: (slots, otherArg) => internal.plainDatesEqual(slots, toPlainDateSlots(otherArg)),
  toZonedDateTime(slots, options) {
    const optionsObj = !internal.isObjectLike(options) || options instanceof TimeZone ? {
      timeZone: options
    } : options;
    return createZonedDateTime(internal.plainDateToZonedDateTime(refineTimeZoneSlot, toPlainTimeSlots, createTimeZoneOps, slots, optionsObj));
  },
  toPlainDateTime: (slots, plainTimeArg) => createPlainDateTime(internal.plainDateToPlainDateTime(slots, optionalToPlainTimeFields(plainTimeArg))),
  toPlainYearMonth(slots) {
    return createPlainYearMonth(internal.plainDateToPlainYearMonth(createYearMonthRefineOps, slots, this));
  },
  toPlainMonthDay(slots) {
    return createPlainMonthDay(internal.plainDateToPlainMonthDay(createMonthDayRefineOps, slots, this));
  },
  toLocaleString(slots, locales, options) {
    const [format, epochMilli] = prepPlainDateFormat(locales, options, slots);
    return format.format(epochMilli);
  },
  toString: internal.formatPlainDateIso,
  toJSON: slots => internal.formatPlainDateIso(slots),
  valueOf: neverValueOf
}, {
  from: (arg, options) => createPlainDate(toPlainDateSlots(arg, options)),
  compare: (arg0, arg1) => internal.compareIsoDateFields(toPlainDateSlots(arg0), toPlainDateSlots(arg1))
}), refineAdapters = {
  fields(calendarProtocol, fieldsMethod, fieldNames) {
    return [ ...fieldsMethod.call(calendarProtocol, fieldNames) ];
  }
}, dateRefineAdapters = {
  dateFromFields(calendarProtocol, dateFromFields, fields, options) {
    return getPlainDateSlots(dateFromFields.call(calendarProtocol, Object.assign(Object.create(null), fields), options));
  },
  ...refineAdapters
}, yearMonthRefineAdapters = {
  yearMonthFromFields(calendarProtocol, yearMonthFromFields, fields, options) {
    return getPlainYearMonthSlots(yearMonthFromFields.call(calendarProtocol, Object.assign(Object.create(null), fields), options));
  },
  ...refineAdapters
}, monthDayRefineAdapters = {
  monthDayFromFields(calendarProtocol, monthDayFromFields, fields, options) {
    return getPlainMonthDaySlots(monthDayFromFields.call(calendarProtocol, Object.assign(Object.create(null), fields), options));
  },
  ...refineAdapters
}, modAdapters = {
  mergeFields(calendarProtocol, mergeFields, fields, additionalFields) {
    return internal.requireObjectLike(mergeFields.call(calendarProtocol, Object.assign(Object.create(null), fields), Object.assign(Object.create(null), additionalFields)));
  }
}, dateModAdapters = {
  ...dateRefineAdapters,
  ...modAdapters
}, yearMonthModAdapters = {
  ...yearMonthRefineAdapters,
  ...modAdapters
}, monthDayModAdapters = {
  ...monthDayRefineAdapters,
  ...modAdapters
}, moveAdapters = {
  dateAdd(calendarProtocol, dateAdd, isoFields, durationFields, options) {
    return getPlainDateSlots(dateAdd.call(calendarProtocol, createPlainDate(internal.createPlainDateSlots(isoFields, calendarProtocol)), createDuration(internal.createDurationSlots(durationFields)), options));
  }
}, diffAdapters = {
  ...moveAdapters,
  dateUntil(calendarProtocol, dateUntil, isoFields0, isoFields1, largestUnit, origOptions) {
    return getDurationSlots(dateUntil.call(calendarProtocol, createPlainDate(internal.createPlainDateSlots(isoFields0, calendarProtocol)), createPlainDate(internal.createPlainDateSlots(isoFields1, calendarProtocol)), Object.assign(Object.create(null), origOptions, {
      largestUnit: internal.unitNamesAsc[largestUnit]
    })));
  }
}, yearMonthMoveAdapters = {
  ...moveAdapters,
  day: dayAdapter
}, yearMonthDiffAdapters = {
  ...diffAdapters,
  day: dayAdapter
}, createYearMonthRefineOps = createCompoundOpsCreator(yearMonthRefineAdapters), createDateRefineOps = createCompoundOpsCreator(dateRefineAdapters), createMonthDayRefineOps = createCompoundOpsCreator(monthDayRefineAdapters), createYearMonthModOps = createCompoundOpsCreator(yearMonthModAdapters), createDateModOps = createCompoundOpsCreator(dateModAdapters), createMonthDayModOps = createCompoundOpsCreator(monthDayModAdapters), createMoveOps = createCompoundOpsCreator(moveAdapters), createDiffOps = createCompoundOpsCreator(diffAdapters), createYearMonthMoveOps = createCompoundOpsCreator(yearMonthMoveAdapters), createYearMonthDiffOps = createCompoundOpsCreator(yearMonthDiffAdapters), [Duration, createDuration, getDurationSlots] = createSlotClass(internal.DurationBranding, internal.constructDurationSlots, {
  ...durationGetters,
  blank: internal.getDurationBlank
}, {
  with: (slots, mod) => createDuration(internal.durationWithFields(slots, mod)),
  negated: slots => createDuration(internal.negateDuration(slots)),
  abs: slots => createDuration(internal.absDuration(slots)),
  add: (slots, otherArg, options) => createDuration(internal.addDurations(refinePublicRelativeTo, createDiffOps, createTimeZoneOps, 0, slots, toDurationSlots(otherArg), options)),
  subtract: (slots, otherArg, options) => createDuration(internal.addDurations(refinePublicRelativeTo, createDiffOps, createTimeZoneOps, 1, slots, toDurationSlots(otherArg), options)),
  round: (slots, options) => createDuration(internal.roundDuration(refinePublicRelativeTo, createDiffOps, createTimeZoneOps, slots, options)),
  total: (slots, options) => internal.totalDuration(refinePublicRelativeTo, createDiffOps, createTimeZoneOps, slots, options),
  toLocaleString(slots, locales, options) {
    return Intl.DurationFormat ? new Intl.DurationFormat(locales, options).format(this) : internal.formatDurationIso(slots);
  },
  toString: internal.formatDurationIso,
  toJSON: slots => internal.formatDurationIso(slots),
  valueOf: neverValueOf
}, {
  from: arg => createDuration(toDurationSlots(arg)),
  compare: (durationArg0, durationArg1, options) => internal.compareDurations(refinePublicRelativeTo, createMoveOps, createTimeZoneOps, toDurationSlots(durationArg0), toDurationSlots(durationArg1), options)
}), calendarMethods = {
  toString: slots => slots.id,
  toJSON: slots => slots.id,
  ...calendarFieldMethods,
  dateAdd: ({id: id, native: native}, plainDateArg, durationArg, options) => createPlainDate(internal.createPlainDateSlots(native.dateAdd(toPlainDateSlots(plainDateArg), toDurationSlots(durationArg), options), id)),
  dateUntil: ({native: native}, plainDateArg0, plainDateArg1, options) => createDuration(internal.createDurationSlots(native.dateUntil(toPlainDateSlots(plainDateArg0), toPlainDateSlots(plainDateArg1), internal.refineDateDiffOptions(options)))),
  dateFromFields: ({id: id, native: native}, fields, options) => createPlainDate(internal.refinePlainDateBag(native, fields, options, internal.getRequiredDateFields(id))),
  yearMonthFromFields: ({id: id, native: native}, fields, options) => createPlainYearMonth(internal.refinePlainYearMonthBag(native, fields, options, internal.getRequiredYearMonthFields(id))),
  monthDayFromFields: ({id: id, native: native}, fields, options) => createPlainMonthDay(internal.refinePlainMonthDayBag(native, 0, fields, options, internal.getRequiredMonthDayFields(id))),
  fields({native: native}, fieldNames) {
    const allowed = new Set(internal.dateFieldNamesAlpha), fieldNamesArray = [];
    for (const fieldName of fieldNames) {
      if (internal.requireString(fieldName), !allowed.has(fieldName)) {
        throw new RangeError(internal.forbiddenField(fieldName));
      }
      allowed.delete(fieldName), fieldNamesArray.push(fieldName);
    }
    return native.fields(fieldNamesArray);
  },
  mergeFields: ({native: native}, fields0, fields1) => native.mergeFields(internal.excludeUndefinedProps(internal.requireNonNullish(fields0)), internal.excludeUndefinedProps(internal.requireNonNullish(fields1)))
}, [Calendar] = createSlotClass("Calendar", (id => {
  const slotId = internal.refineCalendarId(id);
  return {
    branding: "Calendar",
    id: slotId,
    native: internal.createNativeStandardOps(slotId)
  };
}), {
  id: slots => slots.id
}, calendarMethods, {
  from(arg) {
    const calendarSlot = refineCalendarSlot(arg);
    return "string" == typeof calendarSlot ? new Calendar(calendarSlot) : calendarSlot;
  }
}), validateCalendarProtocol = createProtocolValidator(Object.keys(calendarMethods).slice(4)), [ZonedDateTime, createZonedDateTime] = createSlotClass(internal.ZonedDateTimeBranding, internal.bindArgs(internal.constructZonedDateTimeSlots, refineCalendarSlot, refineTimeZoneSlot), {
  ...epochGetters,
  ...calendarIdGetters,
  ...adaptDateMethods(dateGetters),
  ...adaptDateMethods(timeGetters),
  offset: slots => internal.formatOffsetNano(slotsToIso(slots).offsetNanoseconds),
  offsetNanoseconds: slots => slotsToIso(slots).offsetNanoseconds,
  timeZoneId: slots => internal.getId(slots.timeZone),
  hoursInDay: slots => internal.computeZonedHoursInDay(createTimeZoneOps, slots)
}, {
  getISOFields: slots => internal.buildZonedIsoFields(createTimeZoneOffsetOps, slots),
  getCalendar: createCalendarFromSlots,
  getTimeZone: ({timeZone: timeZone}) => "string" == typeof timeZone ? new TimeZone(timeZone) : timeZone,
  with(slots, mod, options) {
    return createZonedDateTime(internal.zonedDateTimeWithFields(createDateModOps, createTimeZoneOps, slots, this, rejectInvalidBag(mod), options));
  },
  withCalendar: (slots, calendarArg) => createZonedDateTime(internal.slotsWithCalendar(slots, refineCalendarSlot(calendarArg))),
  withTimeZone: (slots, timeZoneArg) => createZonedDateTime(internal.slotsWithTimeZone(slots, refineTimeZoneSlot(timeZoneArg))),
  withPlainDate: (slots, plainDateArg) => createZonedDateTime(internal.zonedDateTimeWithPlainDate(createTimeZoneOps, slots, toPlainDateSlots(plainDateArg))),
  withPlainTime: (slots, plainTimeArg) => createZonedDateTime(internal.zonedDateTimeWithPlainTime(createTimeZoneOps, slots, optionalToPlainTimeFields(plainTimeArg))),
  add: (slots, durationArg, options) => createZonedDateTime(internal.moveZonedDateTime(createMoveOps, createTimeZoneOps, 0, slots, toDurationSlots(durationArg), options)),
  subtract: (slots, durationArg, options) => createZonedDateTime(internal.moveZonedDateTime(createMoveOps, createTimeZoneOps, 1, slots, toDurationSlots(durationArg), options)),
  until: (slots, otherArg, options) => createDuration(internal.createDurationSlots(internal.diffZonedDateTimes(createDiffOps, createTimeZoneOps, 0, slots, toZonedDateTimeSlots(otherArg), options))),
  since: (slots, otherArg, options) => createDuration(internal.createDurationSlots(internal.diffZonedDateTimes(createDiffOps, createTimeZoneOps, 1, slots, toZonedDateTimeSlots(otherArg), options))),
  round: (slots, options) => createZonedDateTime(internal.roundZonedDateTime(createTimeZoneOps, slots, options)),
  startOfDay: slots => createZonedDateTime(internal.computeZonedStartOfDay(createTimeZoneOps, slots)),
  equals: (slots, otherArg) => internal.zonedDateTimesEqual(slots, toZonedDateTimeSlots(otherArg)),
  toInstant: slots => createInstant(internal.zonedDateTimeToInstant(slots)),
  toPlainDateTime: slots => createPlainDateTime(internal.zonedDateTimeToPlainDateTime(createTimeZoneOffsetOps, slots)),
  toPlainDate: slots => createPlainDate(internal.zonedDateTimeToPlainDate(createTimeZoneOffsetOps, slots)),
  toPlainTime: slots => createPlainTime(internal.zonedDateTimeToPlainTime(createTimeZoneOffsetOps, slots)),
  toPlainYearMonth(slots) {
    return createPlainYearMonth(internal.zonedDateTimeToPlainYearMonth(createYearMonthRefineOps, slots, this));
  },
  toPlainMonthDay(slots) {
    return createPlainMonthDay(internal.zonedDateTimeToPlainMonthDay(createMonthDayRefineOps, slots, this));
  },
  toLocaleString(slots, locales, options = {}) {
    const [format, epochMilli] = prepZonedDateTimeFormat(locales, options, slots);
    return format.format(epochMilli);
  },
  toString: (slots, options) => internal.formatZonedDateTimeIso(createTimeZoneOffsetOps, slots, options),
  toJSON: slots => internal.formatZonedDateTimeIso(createTimeZoneOffsetOps, slots),
  valueOf: neverValueOf
}, {
  from: (arg, options) => createZonedDateTime(toZonedDateTimeSlots(arg, options)),
  compare: (arg0, arg1) => internal.compareZonedDateTimes(toZonedDateTimeSlots(arg0), toZonedDateTimeSlots(arg1))
}), Now = Object.defineProperties({}, {
  ...internal.createStringTagDescriptors("Temporal.Now"),
  ...internal.createPropDescriptors({
    timeZoneId: () => internal.getCurrentTimeZoneId(),
    instant: () => createInstant(internal.createInstantSlots(internal.getCurrentEpochNano())),
    zonedDateTime: (calendar, timeZone = internal.getCurrentTimeZoneId()) => createZonedDateTime(internal.createZonedDateTimeSlots(internal.getCurrentEpochNano(), refineTimeZoneSlot(timeZone), refineCalendarSlot(calendar))),
    zonedDateTimeISO: (timeZone = internal.getCurrentTimeZoneId()) => createZonedDateTime(internal.createZonedDateTimeSlots(internal.getCurrentEpochNano(), refineTimeZoneSlot(timeZone), internal.isoCalendarId)),
    plainDateTime: (calendar, timeZone = internal.getCurrentTimeZoneId()) => createPlainDateTime(internal.createPlainDateTimeSlots(internal.getCurrentIsoDateTime(createTimeZoneOffsetOps(refineTimeZoneSlot(timeZone))), refineCalendarSlot(calendar))),
    plainDateTimeISO: (timeZone = internal.getCurrentTimeZoneId()) => createPlainDateTime(internal.createPlainDateTimeSlots(internal.getCurrentIsoDateTime(createTimeZoneOffsetOps(refineTimeZoneSlot(timeZone))), internal.isoCalendarId)),
    plainDate: (calendar, timeZone = internal.getCurrentTimeZoneId()) => createPlainDate(internal.createPlainDateSlots(internal.getCurrentIsoDateTime(createTimeZoneOffsetOps(refineTimeZoneSlot(timeZone))), refineCalendarSlot(calendar))),
    plainDateISO: (timeZone = internal.getCurrentTimeZoneId()) => createPlainDate(internal.createPlainDateSlots(internal.getCurrentIsoDateTime(createTimeZoneOffsetOps(refineTimeZoneSlot(timeZone))), internal.isoCalendarId)),
    plainTimeISO: (timeZone = internal.getCurrentTimeZoneId()) => createPlainTime(internal.createPlainTimeSlots(internal.getCurrentIsoDateTime(createTimeZoneOffsetOps(refineTimeZoneSlot(timeZone)))))
  })
}), Temporal = Object.defineProperties({}, {
  ...internal.createStringTagDescriptors("Temporal"),
  ...internal.createPropDescriptors({
    PlainYearMonth: PlainYearMonth,
    PlainMonthDay: PlainMonthDay,
    PlainDate: PlainDate,
    PlainTime: PlainTime,
    PlainDateTime: PlainDateTime,
    ZonedDateTime: ZonedDateTime,
    Instant: Instant,
    Calendar: Calendar,
    TimeZone: TimeZone,
    Duration: Duration,
    Now: Now
  })
}), DateTimeFormat = function() {
  const members = internal.RawDateTimeFormat.prototype, memberDescriptors = Object.getOwnPropertyDescriptors(members), classDescriptors = Object.getOwnPropertyDescriptors(internal.RawDateTimeFormat), DateTimeFormat = function(locales, options = {}) {
    if (!(this instanceof DateTimeFormat)) {
      return new DateTimeFormat(locales, options);
    }
    internalsMap.set(this, ((locales, options = {}) => {
      const rawFormat = new internal.RawDateTimeFormat(locales, options), resolveOptions = rawFormat.resolvedOptions(), resolvedLocale = resolveOptions.locale, copiedOptions = internal.pluckProps(Object.keys(options), resolveOptions), queryFormatPrepperForBranding = internal.memoize(createFormatPrepperForBranding), prepFormat = (...formattables) => {
        let branding;
        const slotsList = formattables.map(((formattable, i) => {
          const slots = getSlots(formattable), slotsBranding = (slots || {}).branding;
          if (i && branding && branding !== slotsBranding) {
            throw new TypeError(internal.mismatchingFormatTypes);
          }
          return branding = slotsBranding, slots;
        }));
        return branding ? queryFormatPrepperForBranding(branding)(resolvedLocale, copiedOptions, ...slotsList) : [ rawFormat, ...formattables ];
      };
      return prepFormat.rawFormat = rawFormat, prepFormat;
    })(locales, options));
  };
  for (const memberName in memberDescriptors) {
    const memberDescriptor = memberDescriptors[memberName], formatLikeMethod = memberName.startsWith("format") && createFormatMethod(memberName);
    "function" == typeof memberDescriptor.value ? memberDescriptor.value = "constructor" === memberName ? DateTimeFormat : formatLikeMethod || createProxiedMethod(memberName) : formatLikeMethod && (memberDescriptor.get = function() {
      return formatLikeMethod.bind(this);
    });
  }
  return classDescriptors.prototype.value = Object.create(members, memberDescriptors), 
  Object.defineProperties(DateTimeFormat, classDescriptors), DateTimeFormat;
}(), internalsMap = new WeakMap, IntlExtended = Object.defineProperties(Object.create(Intl), internal.createPropDescriptors({
  DateTimeFormat: DateTimeFormat
}));

exports.DateTimeFormat = DateTimeFormat, exports.IntlExtended = IntlExtended, exports.Temporal = Temporal, 
exports.toTemporalInstant = function() {
  return createInstant(internal.createInstantSlots(internal.numberToBigNano(this.valueOf(), internal.nanoInMilli)));
};
