"use strict";

function clampProp(props, propName, min, max, overflow) {
  return clampEntity(propName, getDefinedProp(props, propName), min, max, overflow);
}

function clampEntity(entityName, num, min, max, overflow, choices) {
  const clamped = clampNumber(num, min, max);
  if (overflow && num !== clamped) {
    throw new RangeError(numberOutOfRange(entityName, num, min, max, choices));
  }
  return clamped;
}

function getDefinedProp(props, propName) {
  const propVal = props[propName];
  if (void 0 === propVal) {
    throw new TypeError(missingField(propName));
  }
  return propVal;
}

function isObjectLike(arg) {
  return null !== arg && /object|function/.test(typeof arg);
}

function memoize(generator, MapClass = Map) {
  const map = new MapClass;
  return (key, ...otherArgs) => {
    if (map.has(key)) {
      return map.get(key);
    }
    const val = generator(key, ...otherArgs);
    return map.set(key, val), val;
  };
}

function createPropDescriptors(propVals, readonly) {
  return mapProps((value => ({
    value: value,
    configurable: 1,
    writable: !readonly
  })), propVals);
}

function zipProps(propNamesRev, args) {
  const res = {};
  let i = propNamesRev.length;
  for (const arg of args) {
    res[propNamesRev[--i]] = arg;
  }
  return res;
}

function mapProps(transformer, props, extraArg) {
  const res = {};
  for (const propName in props) {
    res[propName] = transformer(props[propName], propName, extraArg);
  }
  return res;
}

function mapPropNames(generator, propNames, extraArg) {
  const props = {};
  for (let i = 0; i < propNames.length; i++) {
    const propName = propNames[i];
    props[propName] = generator(propName, i, extraArg);
  }
  return props;
}

function pluckProps(propNames, props) {
  const res = {};
  for (const propName of propNames) {
    res[propName] = props[propName];
  }
  return res;
}

function excludePropsByName(propNames, props) {
  const filteredProps = {};
  for (const propName in props) {
    propNames.has(propName) || (filteredProps[propName] = props[propName]);
  }
  return filteredProps;
}

function allPropsEqual(propNames, props0, props1) {
  for (const propName of propNames) {
    if (props0[propName] !== props1[propName]) {
      return 0;
    }
  }
  return 1;
}

function zeroOutProps(propNames, clearUntilI, props) {
  const copy = {
    ...props
  };
  for (let i = 0; i < clearUntilI; i++) {
    copy[propNames[i]] = 0;
  }
  return copy;
}

function bindArgs(f, ...boundArgs) {
  return (...dynamicArgs) => f(...boundArgs, ...dynamicArgs);
}

function capitalize(s) {
  return s[0].toUpperCase() + s.substring(1);
}

function sortStrings(strs) {
  return strs.slice().sort();
}

function padNumber(digits, num) {
  return String(num).padStart(digits, "0");
}

function compareNumbers(a, b) {
  return Math.sign(a - b);
}

function clampNumber(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

function divModFloor(num, divisor) {
  return [ Math.floor(num / divisor), modFloor(num, divisor) ];
}

function modFloor(num, divisor) {
  return (num % divisor + divisor) % divisor;
}

function divModTrunc(num, divisor) {
  return [ divTrunc(num, divisor), modTrunc(num, divisor) ];
}

function divTrunc(num, divisor) {
  return Math.trunc(num / divisor) || 0;
}

function modTrunc(num, divisor) {
  return num % divisor || 0;
}

function hasHalf(num) {
  return .5 === Math.abs(num % 1);
}

function givenFieldsToBigNano(fields, largestUnit, fieldNames) {
  let timeNano = 0, days = 0;
  for (let unit = 0; unit <= largestUnit; unit++) {
    const fieldVal = fields[fieldNames[unit]], unitNano = unitNanoMap[unit], unitInDay = nanoInUtcDay / unitNano, [unitDays, leftoverUnits] = divModTrunc(fieldVal, unitInDay);
    timeNano += leftoverUnits * unitNano, days += unitDays;
  }
  const [timeDays, leftoverNano] = divModTrunc(timeNano, nanoInUtcDay);
  return [ days + timeDays, leftoverNano ];
}

function nanoToGivenFields(nano, largestUnit, fieldNames) {
  const fields = {};
  for (let unit = largestUnit; unit >= 0; unit--) {
    const divisor = unitNanoMap[unit];
    fields[fieldNames[unit]] = divTrunc(nano, divisor), nano = modTrunc(nano, divisor);
  }
  return fields;
}

function requirePositiveInteger(arg) {
  return requireNumberIsPositive(requireInteger(arg));
}

function requireInteger(arg) {
  return requireNumberIsInteger(requireNumber(arg));
}

function requirePropDefined(optionName, optionVal) {
  if (null == optionVal) {
    throw new RangeError(missingField(optionName));
  }
  return optionVal;
}

function requireObjectLike(arg) {
  if (!isObjectLike(arg)) {
    throw new TypeError(invalidObject);
  }
  return arg;
}

function requireType(typeName, arg, entityName = typeName) {
  if (typeof arg !== typeName) {
    throw new TypeError(invalidEntity(entityName, arg));
  }
  return arg;
}

function requireNumberIsInteger(num, entityName = "number") {
  if (!Number.isInteger(num)) {
    throw new RangeError(expectedInteger(entityName, num));
  }
  return num || 0;
}

function requireNumberIsPositive(num, entityName = "number") {
  if (num <= 0) {
    throw new RangeError(expectedPositive(entityName, num));
  }
  return num;
}

function toString(arg) {
  if ("symbol" == typeof arg) {
    throw new TypeError(forbiddenSymbolToString);
  }
  return String(arg);
}

function toStringViaPrimitive(arg, entityName) {
  return isObjectLike(arg) ? String(arg) : requireString(arg, entityName);
}

function toBigInt(bi) {
  if ("string" == typeof bi) {
    return BigInt(bi);
  }
  if ("bigint" != typeof bi) {
    throw new TypeError(invalidBigInt(bi));
  }
  return bi;
}

function toNumber(arg, entityName = "number") {
  if ("bigint" == typeof arg) {
    throw new TypeError(forbiddenBigIntToNumber(entityName));
  }
  if (arg = Number(arg), !Number.isFinite(arg)) {
    throw new RangeError(expectedFinite(entityName, arg));
  }
  return arg;
}

function toInteger(arg, entityName) {
  return Math.trunc(toNumber(arg, entityName)) || 0;
}

function toStrictInteger(arg, entityName) {
  return requireNumberIsInteger(toNumber(arg, entityName), entityName);
}

function toPositiveInteger(arg, entityName) {
  return requireNumberIsPositive(toInteger(arg, entityName), entityName);
}

function createBigNano(days, timeNano) {
  let [extraDays, newTimeNano] = divModTrunc(timeNano, nanoInUtcDay), newDays = days + extraDays;
  const newDaysSign = Math.sign(newDays);
  return newDaysSign && newDaysSign === -Math.sign(newTimeNano) && (newDays -= newDaysSign, 
  newTimeNano += newDaysSign * nanoInUtcDay), [ newDays, newTimeNano ];
}

function addBigNanos(a, b, sign = 1) {
  return createBigNano(a[0] + b[0] * sign, a[1] + b[1] * sign);
}

function moveBigNano(a, b) {
  return createBigNano(a[0], a[1] + b);
}

function diffBigNanos(a, b) {
  return addBigNanos(b, a, -1);
}

function compareBigNanos(a, b) {
  return compareNumbers(a[0], b[0]) || compareNumbers(a[1], b[1]);
}

function bigNanoOutside(subject, rangeStart, rangeEndExcl) {
  return -1 === compareBigNanos(subject, rangeStart) || 1 === compareBigNanos(subject, rangeEndExcl);
}

function bigIntToBigNano(num, multiplierNano = 1) {
  const wholeInDay = BigInt(nanoInUtcDay / multiplierNano);
  return [ Number(num / wholeInDay), Number(num % wholeInDay) * multiplierNano ];
}

function numberToBigNano(num, multiplierNano = 1) {
  const wholeInDay = nanoInUtcDay / multiplierNano, [days, remainder] = divModTrunc(num, wholeInDay);
  return [ days, remainder * multiplierNano ];
}

function bigNanoToBigInt(bigNano, divisorNano = 1) {
  const [days, timeNano] = bigNano, whole = Math.floor(timeNano / divisorNano), wholeInDay = nanoInUtcDay / divisorNano;
  return BigInt(days) * BigInt(wholeInDay) + BigInt(whole);
}

function bigNanoToNumber(bigNano, divisorNano = 1, exact) {
  const [days, timeNano] = bigNano, [whole, remainderNano] = divModTrunc(timeNano, divisorNano);
  return days * (nanoInUtcDay / divisorNano) + (whole + (exact ? remainderNano / divisorNano : 0));
}

function divModBigNano(bigNano, divisorNano, divModFunc = divModFloor) {
  const [days, timeNano] = bigNano, [whole, remainderNano] = divModFunc(timeNano, divisorNano);
  return [ days * (nanoInUtcDay / divisorNano) + whole, remainderNano ];
}

function hashIntlFormatParts(intlFormat, epochMilliseconds) {
  const parts = intlFormat.formatToParts(epochMilliseconds), hash = {};
  for (const part of parts) {
    hash[part.type] = part.value;
  }
  return hash;
}

function checkIsoYearMonthInBounds(isoFields) {
  return clampProp(isoFields, "isoYear", isoYearMin, isoYearMax, 1), isoFields.isoYear === isoYearMin ? clampProp(isoFields, "isoMonth", 4, 12, 1) : isoFields.isoYear === isoYearMax && clampProp(isoFields, "isoMonth", 1, 9, 1), 
  isoFields;
}

function checkIsoDateInBounds(isoFields) {
  return checkIsoDateTimeInBounds({
    ...isoFields,
    ...isoTimeFieldDefaults,
    isoHour: 12
  }), isoFields;
}

function checkIsoDateTimeInBounds(isoFields) {
  const isoYear = clampProp(isoFields, "isoYear", isoYearMin, isoYearMax, 1), nudge = isoYear === isoYearMin ? 1 : isoYear === isoYearMax ? -1 : 0;
  return nudge && checkEpochNanoInBounds(isoToEpochNano({
    ...isoFields,
    isoDay: isoFields.isoDay + nudge,
    isoNanosecond: isoFields.isoNanosecond - nudge
  })), isoFields;
}

function checkEpochNanoInBounds(epochNano) {
  if (!epochNano || bigNanoOutside(epochNano, epochNanoMin, epochNanoMax)) {
    throw new RangeError(outOfBoundsDate);
  }
  return epochNano;
}

function isoTimeFieldsToNano(isoTimeFields) {
  return givenFieldsToBigNano(isoTimeFields, 5, isoTimeFieldNamesAsc)[1];
}

function nanoToIsoTimeAndDay(nano) {
  const [dayDelta, timeNano] = divModFloor(nano, nanoInUtcDay);
  return [ nanoToGivenFields(timeNano, 5, isoTimeFieldNamesAsc), dayDelta ];
}

function epochNanoToSec(epochNano) {
  return epochNanoToSecMod(epochNano)[0];
}

function epochNanoToSecMod(epochNano) {
  return divModBigNano(epochNano, nanoInSec);
}

function isoToEpochMilli(isoDateTimeFields) {
  return isoArgsToEpochMilli(isoDateTimeFields.isoYear, isoDateTimeFields.isoMonth, isoDateTimeFields.isoDay, isoDateTimeFields.isoHour, isoDateTimeFields.isoMinute, isoDateTimeFields.isoSecond, isoDateTimeFields.isoMillisecond);
}

function isoToEpochNano(isoFields) {
  const epochMilli = isoToEpochMilli(isoFields);
  if (void 0 !== epochMilli) {
    const [days, milliRemainder] = divModTrunc(epochMilli, milliInDay);
    return [ days, milliRemainder * nanoInMilli + (isoFields.isoMicrosecond || 0) * nanoInMicro + (isoFields.isoNanosecond || 0) ];
  }
}

function isoToEpochNanoWithOffset(isoFields, offsetNano) {
  const [newIsoTimeFields, dayDelta] = nanoToIsoTimeAndDay(isoTimeFieldsToNano(isoFields) - offsetNano);
  return checkEpochNanoInBounds(isoToEpochNano({
    ...isoFields,
    isoDay: isoFields.isoDay + dayDelta,
    ...newIsoTimeFields
  }));
}

function isoArgsToEpochSec(...args) {
  return isoArgsToEpochMilli(...args) / milliInSec;
}

function isoArgsToEpochMilli(...args) {
  const [legacyDate, daysNudged] = isoToLegacyDate(...args), epochMilli = legacyDate.valueOf();
  if (!isNaN(epochMilli)) {
    return epochMilli - daysNudged * milliInDay;
  }
}

function isoToLegacyDate(isoYear, isoMonth = 1, isoDay = 1, isoHour = 0, isoMinute = 0, isoSec = 0, isoMilli = 0) {
  const daysNudged = isoYear === isoYearMin ? 1 : isoYear === isoYearMax ? -1 : 0, legacyDate = new Date;
  return legacyDate.setUTCHours(isoHour, isoMinute, isoSec, isoMilli), legacyDate.setUTCFullYear(isoYear, isoMonth - 1, isoDay + daysNudged), 
  [ legacyDate, daysNudged ];
}

function epochNanoToIso(epochNano, offsetNano) {
  let [days, timeNano] = moveBigNano(epochNano, offsetNano);
  timeNano < 0 && (timeNano += nanoInUtcDay, days -= 1);
  const [timeMilli, nanoRemainder] = divModFloor(timeNano, nanoInMilli), [isoMicrosecond, isoNanosecond] = divModFloor(nanoRemainder, nanoInMicro);
  return epochMilliToIso(days * milliInDay + timeMilli, isoMicrosecond, isoNanosecond);
}

function epochMilliToIso(epochMilli, isoMicrosecond = 0, isoNanosecond = 0) {
  const daysOver = Math.ceil(Math.max(0, Math.abs(epochMilli) - maxMilli) / milliInDay) * Math.sign(epochMilli), legacyDate = new Date(epochMilli - daysOver * milliInDay);
  return zipProps(isoDateTimeFieldNamesAsc, [ legacyDate.getUTCFullYear(), legacyDate.getUTCMonth() + 1, legacyDate.getUTCDate() + daysOver, legacyDate.getUTCHours(), legacyDate.getUTCMinutes(), legacyDate.getUTCSeconds(), legacyDate.getUTCMilliseconds(), isoMicrosecond, isoNanosecond ]);
}

function computeIsoDateParts(isoFields) {
  return [ isoFields.isoYear, isoFields.isoMonth, isoFields.isoDay ];
}

function computeIsoMonthsInYear() {
  return isoMonthsInYear;
}

function computeIsoDaysInMonth(isoYear, isoMonth) {
  switch (isoMonth) {
   case 2:
    return computeIsoInLeapYear(isoYear) ? 29 : 28;

   case 4:
   case 6:
   case 9:
   case 11:
    return 30;
  }
  return 31;
}

function computeIsoDaysInYear(isoYear) {
  return computeIsoInLeapYear(isoYear) ? 366 : 365;
}

function computeIsoInLeapYear(isoYear) {
  return isoYear % 4 == 0 && (isoYear % 100 != 0 || isoYear % 400 == 0);
}

function computeIsoDayOfWeek(isoDateFields) {
  const [legacyDate, daysNudged] = isoToLegacyDate(isoDateFields.isoYear, isoDateFields.isoMonth, isoDateFields.isoDay);
  return modFloor(legacyDate.getUTCDay() - daysNudged, 7) || 7;
}

function computeGregoryEraParts({isoYear: isoYear}) {
  return isoYear < 1 ? [ "bce", 1 - isoYear ] : [ "ce", isoYear ];
}

function checkIsoDateTimeFields(isoDateTimeFields) {
  return checkIsoDateFields(isoDateTimeFields), constrainIsoTimeFields(isoDateTimeFields, 1), 
  isoDateTimeFields;
}

function checkIsoDateFields(isoInternals) {
  return constrainIsoDateFields(isoInternals, 1), isoInternals;
}

function isIsoDateFieldsValid(isoFields) {
  return allPropsEqual(isoDateFieldNamesAsc, isoFields, constrainIsoDateFields(isoFields));
}

function constrainIsoDateFields(isoFields, overflow) {
  const {isoYear: isoYear} = isoFields, isoMonth = clampProp(isoFields, "isoMonth", 1, computeIsoMonthsInYear(), overflow);
  return {
    isoYear: isoYear,
    isoMonth: isoMonth,
    isoDay: clampProp(isoFields, "isoDay", 1, computeIsoDaysInMonth(isoYear, isoMonth), overflow)
  };
}

function constrainIsoTimeFields(isoTimeFields, overflow) {
  return zipProps(isoTimeFieldNamesAsc, [ clampProp(isoTimeFields, "isoHour", 0, 23, overflow), clampProp(isoTimeFields, "isoMinute", 0, 59, overflow), clampProp(isoTimeFields, "isoSecond", 0, 59, overflow), clampProp(isoTimeFields, "isoMillisecond", 0, 999, overflow), clampProp(isoTimeFields, "isoMicrosecond", 0, 999, overflow), clampProp(isoTimeFields, "isoNanosecond", 0, 999, overflow) ]);
}

function refineOverflowOptions(options) {
  return void 0 === options ? 0 : refineOverflow(requireObjectLike(options));
}

function refineZonedFieldOptions(options, defaultOffsetDisambig = 0) {
  options = normalizeOptions(options);
  const epochDisambig = refineEpochDisambig(options), offsetDisambig = refineOffsetDisambig(options, defaultOffsetDisambig);
  return [ refineOverflow(options), offsetDisambig, epochDisambig ];
}

function refineEpochDisambigOptions(options) {
  return refineEpochDisambig(normalizeOptions(options));
}

function refineDiffOptions(roundingModeInvert, options, defaultLargestUnit, maxUnit = 9, minUnit = 0, defaultRoundingMode = 4) {
  options = normalizeOptions(options);
  let largestUnit = refineLargestUnit(options, maxUnit, minUnit), roundingInc = parseRoundingIncInteger(options), roundingMode = refineRoundingMode(options, defaultRoundingMode);
  const smallestUnit = refineSmallestUnit(options, maxUnit, minUnit, 1);
  return null == largestUnit ? largestUnit = Math.max(defaultLargestUnit, smallestUnit) : checkLargestSmallestUnit(largestUnit, smallestUnit), 
  roundingInc = refineRoundingInc(roundingInc, smallestUnit, 1), roundingModeInvert && (roundingMode = (roundingMode => roundingMode < 4 ? (roundingMode + 2) % 4 : roundingMode)(roundingMode)), 
  [ largestUnit, smallestUnit, roundingInc, roundingMode ];
}

function refineRoundingOptions(options, maxUnit = 6, solarMode) {
  let roundingInc = parseRoundingIncInteger(options = normalizeOptionsOrString(options, smallestUnitStr));
  const roundingMode = refineRoundingMode(options, 7);
  let smallestUnit = refineSmallestUnit(options, maxUnit);
  return smallestUnit = requirePropDefined(smallestUnitStr, smallestUnit), roundingInc = refineRoundingInc(roundingInc, smallestUnit, void 0, solarMode), 
  [ smallestUnit, roundingInc, roundingMode ];
}

function refineDateDisplayOptions(options) {
  return refineCalendarDisplay(normalizeOptions(options));
}

function refineTimeDisplayOptions(options, maxSmallestUnit) {
  return refineTimeDisplayTuple(normalizeOptions(options), maxSmallestUnit);
}

function refineTimeDisplayTuple(options, maxSmallestUnit = 4) {
  const subsecDigits = refineSubsecDigits(options);
  return [ refineRoundingMode(options, 4), ...refineSmallestUnitAndSubsecDigits(refineSmallestUnit(options, maxSmallestUnit), subsecDigits) ];
}

function refineSmallestUnitAndSubsecDigits(smallestUnit, subsecDigits) {
  return null != smallestUnit ? [ unitNanoMap[smallestUnit], smallestUnit < 4 ? 9 - 3 * smallestUnit : -1 ] : [ void 0 === subsecDigits ? 1 : 10 ** (9 - subsecDigits), subsecDigits ];
}

function parseRoundingIncInteger(options) {
  const roundingInc = options[roundingIncName];
  return void 0 === roundingInc ? 1 : toInteger(roundingInc, roundingIncName);
}

function refineRoundingInc(roundingInc, smallestUnit, allowManyLargeUnits, solarMode) {
  const upUnitNano = solarMode ? nanoInUtcDay : unitNanoMap[smallestUnit + 1];
  if (upUnitNano) {
    const unitNano = unitNanoMap[smallestUnit];
    if (upUnitNano % ((roundingInc = clampEntity(roundingIncName, roundingInc, 1, upUnitNano / unitNano - (solarMode ? 0 : 1), 1)) * unitNano)) {
      throw new RangeError(invalidEntity(roundingIncName, roundingInc));
    }
  } else {
    roundingInc = clampEntity(roundingIncName, roundingInc, 1, allowManyLargeUnits ? 10 ** 9 : 1, 1);
  }
  return roundingInc;
}

function refineSubsecDigits(options) {
  let subsecDigits = options[subsecDigitsName];
  if (void 0 !== subsecDigits) {
    if ("number" != typeof subsecDigits) {
      if ("auto" === toString(subsecDigits)) {
        return;
      }
      throw new RangeError(invalidEntity(subsecDigitsName, subsecDigits));
    }
    subsecDigits = clampEntity(subsecDigitsName, Math.floor(subsecDigits), 0, 9, 1);
  }
  return subsecDigits;
}

function normalizeOptions(options) {
  return void 0 === options ? {} : requireObjectLike(options);
}

function normalizeOptionsOrString(options, optionName) {
  return "string" == typeof options ? {
    [optionName]: options
  } : requireObjectLike(options);
}

function copyOptions(options) {
  if (void 0 !== options) {
    if (isObjectLike(options)) {
      return Object.assign(Object.create(null), options);
    }
    throw new TypeError(invalidObject);
  }
}

function overrideOverflowOptions(options, overflow) {
  return options && Object.assign(Object.create(null), options, {
    overflow: overflowMapNames[overflow]
  });
}

function refineUnitOption(optionName, options, maxUnit = 9, minUnit = 0, ensureDefined) {
  let unitStr = options[optionName];
  if (void 0 === unitStr) {
    return ensureDefined ? minUnit : void 0;
  }
  if (unitStr = toString(unitStr), "auto" === unitStr) {
    return ensureDefined ? minUnit : null;
  }
  let unit = unitNameMap[unitStr];
  if (void 0 === unit && (unit = durationFieldIndexes[unitStr]), void 0 === unit) {
    throw new RangeError(invalidChoice(optionName, unitStr, unitNameMap));
  }
  return clampEntity(optionName, unit, minUnit, maxUnit, 1, unitNamesAsc), unit;
}

function refineChoiceOption(optionName, enumNameMap, options, defaultChoice = 0) {
  const enumArg = options[optionName];
  if (void 0 === enumArg) {
    return defaultChoice;
  }
  const enumStr = toString(enumArg), enumNum = enumNameMap[enumStr];
  if (void 0 === enumNum) {
    throw new RangeError(invalidChoice(optionName, enumStr, enumNameMap));
  }
  return enumNum;
}

function checkLargestSmallestUnit(largestUnit, smallestUnit) {
  if (smallestUnit > largestUnit) {
    throw new RangeError(flippedSmallestLargestUnit);
  }
}

function createInstantSlots(epochNano) {
  return {
    branding: InstantBranding,
    epochNanoseconds: epochNano
  };
}

function createZonedDateTimeSlots(epochNano, timeZone, calendar) {
  return {
    branding: ZonedDateTimeBranding,
    calendar: calendar,
    timeZone: timeZone,
    epochNanoseconds: epochNano
  };
}

function createPlainDateTimeSlots(isoFields, calendar = isoFields.calendar) {
  return {
    branding: PlainDateTimeBranding,
    calendar: calendar,
    ...pluckProps(isoDateTimeFieldNamesAlpha, isoFields)
  };
}

function createPlainDateSlots(isoFields, calendar = isoFields.calendar) {
  return {
    branding: PlainDateBranding,
    calendar: calendar,
    ...pluckProps(isoDateFieldNamesAlpha, isoFields)
  };
}

function createPlainYearMonthSlots(isoFields, calendar = isoFields.calendar) {
  return {
    branding: PlainYearMonthBranding,
    calendar: calendar,
    ...pluckProps(isoDateFieldNamesAlpha, isoFields)
  };
}

function createPlainMonthDaySlots(isoFields, calendar = isoFields.calendar) {
  return {
    branding: PlainMonthDayBranding,
    calendar: calendar,
    ...pluckProps(isoDateFieldNamesAlpha, isoFields)
  };
}

function createPlainTimeSlots(isoFields) {
  return {
    branding: PlainTimeBranding,
    ...pluckProps(isoTimeFieldNamesAlpha, isoFields)
  };
}

function createDurationSlots(durationFields) {
  return {
    branding: DurationBranding,
    sign: computeDurationSign(durationFields),
    ...pluckProps(durationFieldNamesAlpha, durationFields)
  };
}

function getEpochMilli(slots) {
  return divModBigNano(slots.epochNanoseconds, nanoInMilli)[0];
}

function extractEpochNano(slots) {
  return slots.epochNanoseconds;
}

function getId(idLike) {
  return "string" == typeof idLike ? idLike : requireString(idLike.id);
}

function isIdLikeEqual(idLike0, idLike1) {
  return idLike0 === idLike1 || getId(idLike0) === getId(idLike1);
}

function totalDayTimeDuration(durationFields, totalUnit) {
  return bigNanoToNumber(durationFieldsToBigNano(durationFields), unitNanoMap[totalUnit], 1);
}

function clampRelativeDuration(calendarOps, durationFields, clampUnit, clampDistance, marker, markerToEpochNano, moveMarker) {
  const unitName = durationFieldNamesAsc[clampUnit], durationPlusDistance = {
    ...durationFields,
    [unitName]: durationFields[unitName] + clampDistance
  }, marker0 = moveMarker(calendarOps, marker, durationFields), marker1 = moveMarker(calendarOps, marker, durationPlusDistance);
  return [ markerToEpochNano(marker0), markerToEpochNano(marker1) ];
}

function computeEpochNanoFrac(epochNanoProgress, epochNano0, epochNano1) {
  const denom = bigNanoToNumber(diffBigNanos(epochNano0, epochNano1));
  if (!denom) {
    throw new RangeError(invalidProtocolResults);
  }
  return bigNanoToNumber(diffBigNanos(epochNano0, epochNanoProgress)) / denom;
}

function roundDateTime(isoFields, smallestUnit, roundingInc, roundingMode) {
  return roundDateTimeToNano(isoFields, computeNanoInc(smallestUnit, roundingInc), roundingMode);
}

function roundDateTimeToNano(isoFields, nanoInc, roundingMode) {
  const [roundedIsoFields, dayDelta] = roundTimeToNano(isoFields, nanoInc, roundingMode);
  return checkIsoDateTimeInBounds({
    ...moveByDays(isoFields, dayDelta),
    ...roundedIsoFields
  });
}

function roundTimeToNano(isoFields, nanoInc, roundingMode) {
  return nanoToIsoTimeAndDay(roundByInc(isoTimeFieldsToNano(isoFields), nanoInc, roundingMode));
}

function roundToMinute(offsetNano) {
  return roundByInc(offsetNano, nanoInMinute, 7);
}

function computeNanoInc(smallestUnit, roundingInc) {
  return unitNanoMap[smallestUnit] * roundingInc;
}

function computeDayInterval(isoFields) {
  const isoFields0 = computeDayFloor(isoFields);
  return [ isoFields0, moveByDays(isoFields0, 1) ];
}

function computeDayFloor(isoFields) {
  return clearIsoFields(6, isoFields);
}

function roundDayTimeDurationByInc(durationFields, nanoInc, roundingMode) {
  const maxUnit = Math.min(getMaxDurationUnit(durationFields), 6);
  return nanoToDurationDayTimeFields(roundBigNanoByInc(durationFieldsToBigNano(durationFields, maxUnit), nanoInc, roundingMode), maxUnit);
}

function roundRelativeDuration(durationFields, endEpochNano, largestUnit, smallestUnit, roundingInc, roundingMode, calendarOps, marker, markerToEpochNano, moveMarker) {
  if (0 === smallestUnit && 1 === roundingInc) {
    return durationFields;
  }
  const nudgeFunc = isUniformUnit(smallestUnit, marker) ? isZonedEpochSlots(marker) && smallestUnit < 6 && largestUnit >= 6 ? nudgeZonedTimeDuration : nudgeDayTimeDuration : nudgeRelativeDuration;
  let [roundedDurationFields, roundedEpochNano, grewBigUnit] = nudgeFunc(durationFields, endEpochNano, largestUnit, smallestUnit, roundingInc, roundingMode, calendarOps, marker, markerToEpochNano, moveMarker);
  return grewBigUnit && 7 !== smallestUnit && (roundedDurationFields = ((durationFields, endEpochNano, largestUnit, smallestUnit, calendarOps, marker, markerToEpochNano, moveMarker) => {
    const sign = computeDurationSign(durationFields);
    for (let currentUnit = smallestUnit + 1; currentUnit <= largestUnit; currentUnit++) {
      if (7 === currentUnit && 7 !== largestUnit) {
        continue;
      }
      const baseDurationFields = clearDurationFields(currentUnit, durationFields);
      baseDurationFields[durationFieldNamesAsc[currentUnit]] += sign;
      const beyondThresholdNano = bigNanoToNumber(diffBigNanos(markerToEpochNano(moveMarker(calendarOps, marker, baseDurationFields)), endEpochNano));
      if (beyondThresholdNano && Math.sign(beyondThresholdNano) !== sign) {
        break;
      }
      durationFields = baseDurationFields;
    }
    return durationFields;
  })(roundedDurationFields, roundedEpochNano, largestUnit, Math.max(6, smallestUnit), calendarOps, marker, markerToEpochNano, moveMarker)), 
  roundedDurationFields;
}

function roundBigNano(bigNano, smallestUnit, roundingInc, roundingMode, useDayOrigin) {
  if (6 === smallestUnit) {
    const daysExact = (bigNano => bigNano[0] + bigNano[1] / nanoInUtcDay)(bigNano);
    return [ roundByInc(daysExact, roundingInc, roundingMode), 0 ];
  }
  return roundBigNanoByInc(bigNano, computeNanoInc(smallestUnit, roundingInc), roundingMode, useDayOrigin);
}

function roundBigNanoByInc(bigNano, nanoInc, roundingMode, useDayOrigin) {
  let [days, timeNano] = bigNano;
  useDayOrigin && timeNano < 0 && (timeNano += nanoInUtcDay, days -= 1);
  const [dayDelta, roundedTimeNano] = divModFloor(roundByInc(timeNano, nanoInc, roundingMode), nanoInUtcDay);
  return createBigNano(days + dayDelta, roundedTimeNano);
}

function roundByInc(num, inc, roundingMode) {
  return roundWithMode(num / inc, roundingMode) * inc;
}

function roundWithMode(num, roundingMode) {
  return roundingModeFuncs[roundingMode](num);
}

function nudgeDayTimeDuration(durationFields, endEpochNano, largestUnit, smallestUnit, roundingInc, roundingMode) {
  const sign = computeDurationSign(durationFields), bigNano = durationFieldsToBigNano(durationFields), roundedBigNano = roundBigNano(bigNano, smallestUnit, roundingInc, roundingMode), nanoDiff = diffBigNanos(bigNano, roundedBigNano), expandedBigUnit = Math.sign(roundedBigNano[0] - bigNano[0]) === sign, roundedDayTimeFields = nanoToDurationDayTimeFields(roundedBigNano, Math.min(largestUnit, 6));
  return [ {
    ...durationFields,
    ...roundedDayTimeFields
  }, addBigNanos(endEpochNano, nanoDiff), expandedBigUnit ];
}

function nudgeZonedTimeDuration(durationFields, endEpochNano, _largestUnit, smallestUnit, roundingInc, roundingMode, calendarOps, marker, markerToEpochNano, moveMarker) {
  const sign = computeDurationSign(durationFields), timeNano = bigNanoToNumber(durationFieldsToBigNano(durationFields, 5)), nanoInc = computeNanoInc(smallestUnit, roundingInc);
  let roundedTimeNano = roundByInc(timeNano, nanoInc, roundingMode);
  const [dayEpochNano0, dayEpochNano1] = clampRelativeDuration(calendarOps, {
    ...durationFields,
    ...durationTimeFieldDefaults
  }, 6, sign, marker, markerToEpochNano, moveMarker), beyondDayNano = roundedTimeNano - bigNanoToNumber(diffBigNanos(dayEpochNano0, dayEpochNano1));
  let dayDelta = 0;
  beyondDayNano && Math.sign(beyondDayNano) !== sign ? endEpochNano = moveBigNano(dayEpochNano0, roundedTimeNano) : (dayDelta += sign, 
  roundedTimeNano = roundByInc(beyondDayNano, nanoInc, roundingMode), endEpochNano = moveBigNano(dayEpochNano1, roundedTimeNano));
  const durationTimeFields = nanoToDurationTimeFields(roundedTimeNano);
  return [ {
    ...durationFields,
    ...durationTimeFields,
    days: durationFields.days + dayDelta
  }, endEpochNano, Boolean(dayDelta) ];
}

function nudgeRelativeDuration(durationFields, endEpochNano, _largestUnit, smallestUnit, roundingInc, roundingMode, calendarOps, marker, markerToEpochNano, moveMarker) {
  const sign = computeDurationSign(durationFields), smallestUnitFieldName = durationFieldNamesAsc[smallestUnit], baseDurationFields = clearDurationFields(smallestUnit, durationFields);
  7 === smallestUnit && (durationFields = {
    ...durationFields,
    weeks: durationFields.weeks + Math.trunc(durationFields.days / 7)
  });
  const truncedVal = divTrunc(durationFields[smallestUnitFieldName], roundingInc) * roundingInc;
  baseDurationFields[smallestUnitFieldName] = truncedVal;
  const [epochNano0, epochNano1] = clampRelativeDuration(calendarOps, baseDurationFields, smallestUnit, roundingInc * sign, marker, markerToEpochNano, moveMarker), exactVal = truncedVal + computeEpochNanoFrac(endEpochNano, epochNano0, epochNano1) * sign * roundingInc, roundedVal = roundByInc(exactVal, roundingInc, roundingMode), expanded = Math.sign(roundedVal - exactVal) === sign;
  return baseDurationFields[smallestUnitFieldName] = roundedVal, [ baseDurationFields, expanded ? epochNano1 : epochNano0, expanded ];
}

function formatDateLikeIso(calendarIdLike, formatSimple, isoFields, calendarDisplay) {
  const calendarId = getId(calendarIdLike), showCalendar = calendarDisplay > 1 || 0 === calendarDisplay && calendarId !== isoCalendarId;
  return 1 === calendarDisplay ? calendarId === isoCalendarId ? formatSimple(isoFields) : formatIsoDateFields(isoFields) : showCalendar ? formatIsoDateFields(isoFields) + formatCalendarId(calendarId, 2 === calendarDisplay) : formatSimple(isoFields);
}

function formatDurationFragments(fragObj) {
  const parts = [];
  for (const fragName in fragObj) {
    const fragVal = fragObj[fragName];
    fragVal && parts.push(fragVal, fragName);
  }
  return parts.join("");
}

function formatIsoDateTimeFields(isoDateTimeFields, subsecDigits) {
  return formatIsoDateFields(isoDateTimeFields) + "T" + formatIsoTimeFields(isoDateTimeFields, subsecDigits);
}

function formatIsoDateFields(isoDateFields) {
  return formatIsoYearMonthFields(isoDateFields) + "-" + padNumber2(isoDateFields.isoDay);
}

function formatIsoYearMonthFields(isoDateFields) {
  const {isoYear: isoYear} = isoDateFields;
  return (isoYear < 0 || isoYear > 9999 ? getSignStr(isoYear) + padNumber(6, Math.abs(isoYear)) : padNumber(4, isoYear)) + "-" + padNumber2(isoDateFields.isoMonth);
}

function formatIsoMonthDayFields(isoDateFields) {
  return padNumber2(isoDateFields.isoMonth) + "-" + padNumber2(isoDateFields.isoDay);
}

function formatIsoTimeFields(isoTimeFields, subsecDigits) {
  const parts = [ padNumber2(isoTimeFields.isoHour), padNumber2(isoTimeFields.isoMinute) ];
  return -1 !== subsecDigits && parts.push(padNumber2(isoTimeFields.isoSecond) + ((isoMillisecond, isoMicrosecond, isoNanosecond, subsecDigits) => formatSubsecNano(isoMillisecond * nanoInMilli + isoMicrosecond * nanoInMicro + isoNanosecond, subsecDigits))(isoTimeFields.isoMillisecond, isoTimeFields.isoMicrosecond, isoTimeFields.isoNanosecond, subsecDigits)), 
  parts.join(":");
}

function formatOffsetNano(offsetNano, offsetDisplay = 0) {
  if (1 === offsetDisplay) {
    return "";
  }
  const [hour, nanoRemainder0] = divModFloor(Math.abs(offsetNano), nanoInHour), [minute, nanoRemainder1] = divModFloor(nanoRemainder0, nanoInMinute), [second, nanoRemainder2] = divModFloor(nanoRemainder1, nanoInSec);
  return getSignStr(offsetNano) + padNumber2(hour) + ":" + padNumber2(minute) + (second || nanoRemainder2 ? ":" + padNumber2(second) + formatSubsecNano(nanoRemainder2) : "");
}

function formatCalendar(calendarIdLike, calendarDisplay) {
  if (1 !== calendarDisplay) {
    const calendarId = getId(calendarIdLike);
    if (calendarDisplay > 1 || 0 === calendarDisplay && calendarId !== isoCalendarId) {
      return formatCalendarId(calendarId, 2 === calendarDisplay);
    }
  }
  return "";
}

function formatCalendarId(calendarId, isCritical) {
  return "[" + (isCritical ? "!" : "") + "u-ca=" + calendarId + "]";
}

function formatSubsecNano(totalNano, subsecDigits) {
  let s = padNumber(9, totalNano);
  return s = void 0 === subsecDigits ? s.replace(trailingZerosRE, "") : s.slice(0, subsecDigits), 
  s ? "." + s : "";
}

function getSignStr(num) {
  return num < 0 ? "-" : "+";
}

function formatDurationNumber(n, force) {
  return n || force ? n.toLocaleString("fullwide", {
    useGrouping: 0
  }) : "";
}

function getMatchingInstantFor(timeZoneOps, isoFields, offsetNano, offsetDisambig = 0, epochDisambig = 0, epochFuzzy, hasZ) {
  if (void 0 !== offsetNano && 1 === offsetDisambig && (1 === offsetDisambig || hasZ)) {
    return isoToEpochNanoWithOffset(isoFields, offsetNano);
  }
  const possibleEpochNanos = timeZoneOps.getPossibleInstantsFor(isoFields);
  if (void 0 !== offsetNano && 3 !== offsetDisambig) {
    const matchingEpochNano = ((possibleEpochNanos, isoDateTimeFields, offsetNano, fuzzy) => {
      const zonedEpochNano = isoToEpochNano(isoDateTimeFields);
      fuzzy && (offsetNano = roundToMinute(offsetNano));
      for (const possibleEpochNano of possibleEpochNanos) {
        let possibleOffsetNano = bigNanoToNumber(diffBigNanos(possibleEpochNano, zonedEpochNano));
        if (fuzzy && (possibleOffsetNano = roundToMinute(possibleOffsetNano)), possibleOffsetNano === offsetNano) {
          return possibleEpochNano;
        }
      }
    })(possibleEpochNanos, isoFields, offsetNano, epochFuzzy);
    if (void 0 !== matchingEpochNano) {
      return matchingEpochNano;
    }
    if (0 === offsetDisambig) {
      throw new RangeError(invalidOffsetForTimeZone);
    }
  }
  return hasZ ? isoToEpochNano(isoFields) : getSingleInstantFor(timeZoneOps, isoFields, epochDisambig, possibleEpochNanos);
}

function getSingleInstantFor(timeZoneOps, isoFields, disambig = 0, possibleEpochNanos = timeZoneOps.getPossibleInstantsFor(isoFields)) {
  if (1 === possibleEpochNanos.length) {
    return possibleEpochNanos[0];
  }
  if (1 === disambig) {
    throw new RangeError(ambigOffset);
  }
  if (possibleEpochNanos.length) {
    return possibleEpochNanos[3 === disambig ? 1 : 0];
  }
  const zonedEpochNano = isoToEpochNano(isoFields), gapNano = ((timeZoneOps, zonedEpochNano) => {
    const startOffsetNano = timeZoneOps.getOffsetNanosecondsFor(moveBigNano(zonedEpochNano, -nanoInUtcDay));
    return validateTimeZoneGap(timeZoneOps.getOffsetNanosecondsFor(moveBigNano(zonedEpochNano, nanoInUtcDay)) - startOffsetNano);
  })(timeZoneOps, zonedEpochNano), shiftNano = gapNano * (2 === disambig ? -1 : 1);
  return (possibleEpochNanos = timeZoneOps.getPossibleInstantsFor(epochNanoToIso(zonedEpochNano, shiftNano)))[2 === disambig ? 0 : possibleEpochNanos.length - 1];
}

function validateTimeZoneOffset(offsetNano) {
  if (Math.abs(offsetNano) >= nanoInUtcDay) {
    throw new RangeError(outOfBoundsOffset);
  }
  return offsetNano;
}

function validateTimeZoneGap(gapNano) {
  if (gapNano > nanoInUtcDay) {
    throw new RangeError(outOfBoundsDstGap);
  }
  return gapNano;
}

function moveZonedEpochs(timeZoneOps, calendarOps, slots, durationFields, options) {
  const timeOnlyNano = durationFieldsToBigNano(durationFields, 5);
  let epochNano = slots.epochNanoseconds;
  if (durationHasDateParts(durationFields)) {
    const isoDateTimeFields = zonedEpochSlotsToIso(slots, timeZoneOps);
    epochNano = addBigNanos(getSingleInstantFor(timeZoneOps, {
      ...moveDate(calendarOps, isoDateTimeFields, {
        ...durationFields,
        ...durationTimeFieldDefaults
      }, options),
      ...pluckProps(isoTimeFieldNamesAsc, isoDateTimeFields)
    }), timeOnlyNano);
  } else {
    epochNano = addBigNanos(epochNano, timeOnlyNano), refineOverflowOptions(options);
  }
  return {
    epochNanoseconds: checkEpochNanoInBounds(epochNano)
  };
}

function moveDateTime(calendarOps, isoDateTimeFields, durationFields, options) {
  const [movedIsoTimeFields, dayDelta] = moveTime(isoDateTimeFields, durationFields);
  return checkIsoDateTimeInBounds({
    ...moveDate(calendarOps, isoDateTimeFields, {
      ...durationFields,
      ...durationTimeFieldDefaults,
      days: durationFields.days + dayDelta
    }, options),
    ...movedIsoTimeFields
  });
}

function moveDate(calendarOps, isoDateFields, durationFields, options) {
  if (durationFields.years || durationFields.months || durationFields.weeks) {
    return calendarOps.dateAdd(isoDateFields, durationFields, options);
  }
  refineOverflowOptions(options);
  const days = durationFields.days + durationFieldsToBigNano(durationFields, 5)[0];
  return days ? checkIsoDateInBounds(moveByDays(isoDateFields, days)) : isoDateFields;
}

function moveToDayOfMonthUnsafe(calendarOps, isoFields, dayOfMonth = 1) {
  return moveByDays(isoFields, dayOfMonth - calendarOps.day(isoFields));
}

function moveTime(isoFields, durationFields) {
  const [durDays, durTimeNano] = durationFieldsToBigNano(durationFields, 5), [newIsoFields, overflowDays] = nanoToIsoTimeAndDay(isoTimeFieldsToNano(isoFields) + durTimeNano);
  return [ newIsoFields, durDays + overflowDays ];
}

function moveByDays(isoFields, days) {
  return days ? {
    ...isoFields,
    ...epochMilliToIso(isoToEpochMilli(isoFields) + days * milliInDay)
  } : isoFields;
}

function createMarkerSystem(getCalendarOps, getTimeZoneOps, relativeToSlots) {
  const calendarOps = getCalendarOps(relativeToSlots.calendar);
  return isZonedEpochSlots(relativeToSlots) ? [ relativeToSlots, calendarOps, getTimeZoneOps(relativeToSlots.timeZone) ] : [ {
    ...relativeToSlots,
    ...isoTimeFieldDefaults
  }, calendarOps ];
}

function createMarkerToEpochNano(timeZoneOps) {
  return timeZoneOps ? extractEpochNano : isoToEpochNano;
}

function createMoveMarker(timeZoneOps) {
  return timeZoneOps ? bindArgs(moveZonedEpochs, timeZoneOps) : moveDateTime;
}

function createDiffMarkers(timeZoneOps) {
  return timeZoneOps ? bindArgs(diffZonedEpochsExact, timeZoneOps) : diffDateTimesExact;
}

function isZonedEpochSlots(marker) {
  return marker && marker.epochNanoseconds;
}

function isUniformUnit(unit, marker) {
  return unit <= 6 - (isZonedEpochSlots(marker) ? 1 : 0);
}

function negateDuration(slots) {
  return createDurationSlots(negateDurationFields(slots));
}

function negateDurationFields(fields) {
  const res = {};
  for (const fieldName of durationFieldNamesAsc) {
    res[fieldName] = -1 * fields[fieldName] || 0;
  }
  return res;
}

function computeDurationSign(fields, fieldNames = durationFieldNamesAsc) {
  let sign = 0;
  for (const fieldName of fieldNames) {
    const fieldSign = Math.sign(fields[fieldName]);
    if (fieldSign) {
      if (sign && sign !== fieldSign) {
        throw new RangeError(forbiddenDurationSigns);
      }
      sign = fieldSign;
    }
  }
  return sign;
}

function checkDurationUnits(fields) {
  for (const calendarUnit of durationCalendarFieldNamesAsc) {
    clampEntity(calendarUnit, fields[calendarUnit], -maxCalendarUnit, maxCalendarUnit, 1);
  }
  return checkDurationTimeUnit(bigNanoToNumber(durationFieldsToBigNano(fields), nanoInSec)), 
  fields;
}

function checkDurationTimeUnit(n) {
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(outOfBoundsDuration);
  }
}

function durationFieldsToBigNano(fields, largestUnit = 6) {
  return givenFieldsToBigNano(fields, largestUnit, durationFieldNamesAsc);
}

function nanoToDurationDayTimeFields(bigNano, largestUnit = 6) {
  const [days, timeNano] = bigNano, dayTimeFields = nanoToGivenFields(timeNano, largestUnit, durationFieldNamesAsc);
  if (dayTimeFields[durationFieldNamesAsc[largestUnit]] += days * (nanoInUtcDay / unitNanoMap[largestUnit]), 
  !Number.isFinite(dayTimeFields[durationFieldNamesAsc[largestUnit]])) {
    throw new RangeError(outOfBoundsDate);
  }
  return dayTimeFields;
}

function nanoToDurationTimeFields(nano, largestUnit = 5) {
  return nanoToGivenFields(nano, largestUnit, durationFieldNamesAsc);
}

function durationHasDateParts(fields) {
  return Boolean(computeDurationSign(fields, durationDateFieldNamesAsc));
}

function getMaxDurationUnit(fields) {
  let unit = 9;
  for (;unit > 0 && !fields[durationFieldNamesAsc[unit]]; unit--) {}
  return unit;
}

function createSplitTuple(startEpochSec, endEpochSec) {
  return [ startEpochSec, endEpochSec ];
}

function computePeriod(epochSec) {
  const startEpochSec = Math.floor(epochSec / periodDur) * periodDur;
  return [ startEpochSec, startEpochSec + periodDur ];
}

function parseOffsetNano(s) {
  const offsetNano = parseOffsetNanoMaybe(s);
  if (void 0 === offsetNano) {
    throw new RangeError(failedParse(s));
  }
  return offsetNano;
}

function parsePlainDate(s) {
  const organized = parseDateTimeLike(requireString(s));
  if (!organized || organized.hasZ) {
    throw new RangeError(failedParse(s));
  }
  return createPlainDateSlots(organized.hasTime ? finalizeDateTime(organized) : finalizeDate(organized));
}

function requireIsoCalendar(organized) {
  if (organized.calendar !== isoCalendarId) {
    throw new RangeError(invalidSubstring(organized.calendar));
  }
}

function finalizeZonedDateTime(organized, offsetNano, offsetDisambig = 0, epochDisambig = 0) {
  const slotId = resolveTimeZoneId(organized.timeZone), timeZoneImpl = queryNativeTimeZone(slotId);
  return createZonedDateTimeSlots(getMatchingInstantFor(timeZoneImpl, checkIsoDateTimeFields(organized), offsetNano, offsetDisambig, epochDisambig, !timeZoneImpl.offsetNano, organized.hasZ), slotId, resolveCalendarId(organized.calendar));
}

function finalizeDateTime(organized) {
  return resolveSlotsCalendar(checkIsoDateTimeInBounds(checkIsoDateTimeFields(organized)));
}

function finalizeDate(organized) {
  return resolveSlotsCalendar(checkIsoDateInBounds(checkIsoDateFields(organized)));
}

function resolveSlotsCalendar(organized) {
  return {
    ...organized,
    calendar: resolveCalendarId(organized.calendar)
  };
}

function parseDateTimeLike(s) {
  const parts = dateTimeRegExp.exec(s);
  return parts ? (parts => {
    const zOrOffset = parts[10], hasZ = "Z" === (zOrOffset || "").toUpperCase();
    return {
      isoYear: organizeIsoYearParts(parts),
      isoMonth: parseInt(parts[4]),
      isoDay: parseInt(parts[5]),
      ...organizeTimeParts(parts.slice(5)),
      ...organizeAnnotationParts(parts[16]),
      hasTime: Boolean(parts[6]),
      hasZ: hasZ,
      offset: hasZ ? void 0 : zOrOffset
    };
  })(parts) : void 0;
}

function parseYearMonthOnly(s) {
  const parts = yearMonthRegExp.exec(s);
  return parts ? (parts => ({
    isoYear: organizeIsoYearParts(parts),
    isoMonth: parseInt(parts[4]),
    isoDay: 1,
    ...organizeAnnotationParts(parts[5])
  }))(parts) : void 0;
}

function parseMonthDayOnly(s) {
  const parts = monthDayRegExp.exec(s);
  return parts ? (parts => ({
    isoYear: isoEpochFirstLeapYear,
    isoMonth: parseInt(parts[1]),
    isoDay: parseInt(parts[2]),
    ...organizeAnnotationParts(parts[3])
  }))(parts) : void 0;
}

function parseOffsetNanoMaybe(s, onlyHourMinute) {
  const parts = offsetRegExp.exec(s);
  return parts ? ((parts, onlyHourMinute) => {
    const firstSubMinutePart = parts[4] || parts[5];
    if (onlyHourMinute && firstSubMinutePart) {
      throw new RangeError(invalidSubstring(firstSubMinutePart));
    }
    return validateTimeZoneOffset((parseInt0(parts[2]) * nanoInHour + parseInt0(parts[3]) * nanoInMinute + parseInt0(parts[4]) * nanoInSec + parseSubsecNano(parts[5] || "")) * parseSign(parts[1]));
  })(parts, onlyHourMinute) : void 0;
}

function organizeIsoYearParts(parts) {
  const yearSign = parseSign(parts[1]), year = parseInt(parts[2] || parts[3]);
  if (yearSign < 0 && !year) {
    throw new RangeError(invalidSubstring(-0));
  }
  return yearSign * year;
}

function organizeTimeParts(parts) {
  const isoSecond = parseInt0(parts[3]);
  return {
    ...nanoToIsoTimeAndDay(parseSubsecNano(parts[4] || ""))[0],
    isoHour: parseInt0(parts[1]),
    isoMinute: parseInt0(parts[2]),
    isoSecond: 60 === isoSecond ? 59 : isoSecond
  };
}

function organizeAnnotationParts(s) {
  let calendarIsCritical, timeZoneId;
  const calendarIds = [];
  if (s.replace(annotationRegExp, ((whole, criticalStr, mainStr) => {
    const isCritical = Boolean(criticalStr), [val, name] = mainStr.split("=").reverse();
    if (name) {
      if ("u-ca" === name) {
        calendarIds.push(val), calendarIsCritical || (calendarIsCritical = isCritical);
      } else if (isCritical || /[A-Z]/.test(name)) {
        throw new RangeError(invalidSubstring(whole));
      }
    } else {
      if (timeZoneId) {
        throw new RangeError(invalidSubstring(whole));
      }
      timeZoneId = val;
    }
    return "";
  })), calendarIds.length > 1 && calendarIsCritical) {
    throw new RangeError(invalidSubstring(s));
  }
  return {
    timeZone: timeZoneId,
    calendar: calendarIds[0] || isoCalendarId
  };
}

function parseSubsecNano(fracStr) {
  return parseInt(fracStr.padEnd(9, "0"));
}

function createRegExp(meat) {
  return new RegExp(`^${meat}$`, "i");
}

function parseSign(s) {
  return s && "+" !== s ? -1 : 1;
}

function parseInt0(s) {
  return void 0 === s ? 0 : parseInt(s);
}

function resolveTimeZoneId(id) {
  const essence = getTimeZoneEssence(id);
  return "number" == typeof essence ? formatOffsetNano(essence) : essence ? (id => {
    if (icuRegExp.test(id)) {
      throw new RangeError(forbiddenIcuTimeZone);
    }
    return id.toLowerCase().split("/").map(((part, partI) => (part.length <= 3 || /\d/.test(part)) && !/etc|yap/.test(part) ? part.toUpperCase() : part.replace(/baja|dumont|[a-z]+/g, ((a, i) => a.length <= 2 && !partI || "in" === a || "chat" === a ? a.toUpperCase() : a.length > 2 || !i ? capitalize(a).replace(/island|noronha|murdo|rivadavia|urville/, capitalize) : a)))).join("/");
  })(id) : utcTimeZoneId;
}

function getTimeZoneAtomic(id) {
  const essence = getTimeZoneEssence(id);
  return "number" == typeof essence ? essence : essence ? essence.resolvedOptions().timeZone : utcTimeZoneId;
}

function getTimeZoneEssence(id) {
  const offsetNano = parseOffsetNanoMaybe(id = id.toUpperCase(), 1);
  return void 0 !== offsetNano ? offsetNano : id !== utcTimeZoneId ? queryTimeZoneIntlFormat(id) : void 0;
}

function compareInstants(instantSlots0, instantSlots1) {
  return compareBigNanos(instantSlots0.epochNanoseconds, instantSlots1.epochNanoseconds);
}

function compareZonedDateTimes(zonedDateTimeSlots0, zonedDateTimeSlots1) {
  return compareBigNanos(zonedDateTimeSlots0.epochNanoseconds, zonedDateTimeSlots1.epochNanoseconds);
}

function compareIsoDateTimeFields(isoFields0, isoFields1) {
  return compareIsoDateFields(isoFields0, isoFields1) || compareIsoTimeFields(isoFields0, isoFields1);
}

function compareIsoDateFields(isoFields0, isoFields1) {
  return compareNumbers(isoToEpochMilli(isoFields0), isoToEpochMilli(isoFields1));
}

function compareIsoTimeFields(isoFields0, isoFields1) {
  return compareNumbers(isoTimeFieldsToNano(isoFields0), isoTimeFieldsToNano(isoFields1));
}

function isTimeZoneSlotsEqual(a, b) {
  if (a === b) {
    return 1;
  }
  const aId = getId(a), bId = getId(b);
  if (aId === bId) {
    return 1;
  }
  try {
    return getTimeZoneAtomic(aId) === getTimeZoneAtomic(bId);
  } catch (_a) {}
}

function diffDateLike(invert, getCalendarOps, startIsoFields, endIsoFields, largestUnit, smallestUnit, roundingInc, roundingMode, origOptions) {
  const startEpochNano = isoToEpochNano(startIsoFields), endEpochNano = isoToEpochNano(endIsoFields);
  let durationFields;
  if (compareBigNanos(endEpochNano, startEpochNano)) {
    if (6 === largestUnit) {
      durationFields = diffEpochNanos(startEpochNano, endEpochNano, largestUnit, smallestUnit, roundingInc, roundingMode);
    } else {
      const calendarOps = getCalendarOps();
      durationFields = calendarOps.dateUntil(startIsoFields, endIsoFields, largestUnit, origOptions), 
      6 === smallestUnit && 1 === roundingInc || (durationFields = roundRelativeDuration(durationFields, endEpochNano, largestUnit, smallestUnit, roundingInc, roundingMode, calendarOps, startIsoFields, isoToEpochNano, moveDate));
    }
  } else {
    durationFields = durationFieldDefaults;
  }
  return createDurationSlots(invert ? negateDurationFields(durationFields) : durationFields);
}

function diffZonedEpochsExact(timeZoneOps, calendarOps, slots0, slots1, largestUnit, origOptions) {
  const sign = compareBigNanos(slots1.epochNanoseconds, slots0.epochNanoseconds);
  return sign ? largestUnit < 6 ? diffEpochNanosExact(slots0.epochNanoseconds, slots1.epochNanoseconds, largestUnit) : diffZonedEpochsBig(calendarOps, timeZoneOps, slots0, slots1, sign, largestUnit, origOptions) : durationFieldDefaults;
}

function diffDateTimesExact(calendarOps, startIsoFields, endIsoFields, largestUnit, origOptions) {
  const startEpochNano = isoToEpochNano(startIsoFields), endEpochNano = isoToEpochNano(endIsoFields), sign = compareBigNanos(endEpochNano, startEpochNano);
  return sign ? largestUnit <= 6 ? diffEpochNanosExact(startEpochNano, endEpochNano, largestUnit) : diffDateTimesBig(calendarOps, startIsoFields, endIsoFields, sign, largestUnit, origOptions) : durationFieldDefaults;
}

function diffZonedEpochsBig(calendarOps, timeZoneOps, slots0, slots1, sign, largestUnit, origOptions) {
  const [isoFields0, isoFields1, remainderNano] = ((timeZoneOps, slots0, slots1, sign) => {
    function updateMid() {
      return midIsoFields = {
        ...moveByDays(endIsoFields, dayCorrection++ * -sign),
        ...startIsoTimeFields
      }, midEpochNano = getSingleInstantFor(timeZoneOps, midIsoFields), compareBigNanos(endEpochNano, midEpochNano) === -sign;
    }
    const startIsoFields = zonedEpochSlotsToIso(slots0, timeZoneOps), startIsoTimeFields = pluckProps(isoTimeFieldNamesAsc, startIsoFields), endIsoFields = zonedEpochSlotsToIso(slots1, timeZoneOps), endEpochNano = slots1.epochNanoseconds;
    let dayCorrection = 0;
    const timeDiffNano = diffTimes(startIsoFields, endIsoFields);
    let midIsoFields, midEpochNano;
    if (Math.sign(timeDiffNano) === -sign && dayCorrection++, updateMid() && (-1 === sign || updateMid())) {
      throw new RangeError(invalidProtocolResults);
    }
    const remainderNano = bigNanoToNumber(diffBigNanos(midEpochNano, endEpochNano));
    return [ startIsoFields, midIsoFields, remainderNano ];
  })(timeZoneOps, slots0, slots1, sign);
  var startIsoFields, endIsoFields;
  return {
    ...6 === largestUnit ? (startIsoFields = isoFields0, endIsoFields = isoFields1, 
    {
      ...durationFieldDefaults,
      days: diffDays(startIsoFields, endIsoFields)
    }) : calendarOps.dateUntil(isoFields0, isoFields1, largestUnit, origOptions),
    ...nanoToDurationTimeFields(remainderNano)
  };
}

function diffDateTimesBig(calendarOps, startIsoFields, endIsoFields, sign, largestUnit, origOptions) {
  const [startIsoDate, endIsoDate, timeNano] = ((startIsoDateTime, endIsoDateTime, sign) => {
    let endIsoDate = endIsoDateTime, timeDiffNano = diffTimes(startIsoDateTime, endIsoDateTime);
    return Math.sign(timeDiffNano) === -sign && (endIsoDate = moveByDays(endIsoDateTime, -sign), 
    timeDiffNano += nanoInUtcDay * sign), [ startIsoDateTime, endIsoDate, timeDiffNano ];
  })(startIsoFields, endIsoFields, sign);
  return {
    ...calendarOps.dateUntil(startIsoDate, endIsoDate, largestUnit, origOptions),
    ...nanoToDurationTimeFields(timeNano)
  };
}

function diffEpochNanos(startEpochNano, endEpochNano, largestUnit, smallestUnit, roundingInc, roundingMode) {
  return {
    ...durationFieldDefaults,
    ...nanoToDurationDayTimeFields(roundBigNano(diffBigNanos(startEpochNano, endEpochNano), smallestUnit, roundingInc, roundingMode), largestUnit)
  };
}

function diffEpochNanosExact(startEpochNano, endEpochNano, largestUnit) {
  return {
    ...durationFieldDefaults,
    ...nanoToDurationDayTimeFields(diffBigNanos(startEpochNano, endEpochNano), largestUnit)
  };
}

function diffDays(startIsoFields, endIsoFields) {
  return diffEpochMilliByDay(isoToEpochMilli(startIsoFields), isoToEpochMilli(endIsoFields));
}

function diffEpochMilliByDay(epochMilli0, epochMilli1) {
  return Math.trunc((epochMilli1 - epochMilli0) / milliInDay);
}

function diffTimes(isoTime0, isoTime1) {
  return isoTimeFieldsToNano(isoTime1) - isoTimeFieldsToNano(isoTime0);
}

function getCommonCalendarSlot(a, b) {
  if (!isIdLikeEqual(a, b)) {
    throw new RangeError(mismatchingCalendars);
  }
  return a;
}

function createIntlFieldCache(epochMilliToIntlFields) {
  return memoize((isoDateFields => {
    const epochMilli = isoToEpochMilli(isoDateFields);
    return epochMilliToIntlFields(epochMilli);
  }), WeakMap);
}

function createIntlYearDataCache(epochMilliToIntlFields) {
  const yearCorrection = epochMilliToIntlFields(0).year - isoEpochOriginYear;
  return memoize((year => {
    let intlFields, epochMilli = isoArgsToEpochMilli(year - yearCorrection);
    const millisReversed = [], monthStringsReversed = [];
    do {
      epochMilli += 400 * milliInDay;
    } while ((intlFields = epochMilliToIntlFields(epochMilli)).year <= year);
    do {
      epochMilli += (1 - intlFields.day) * milliInDay, intlFields.year === year && (millisReversed.push(epochMilli), 
      monthStringsReversed.push(intlFields.monthString)), epochMilli -= milliInDay;
    } while ((intlFields = epochMilliToIntlFields(epochMilli)).year >= year);
    return {
      monthEpochMillis: millisReversed.reverse(),
      monthStringToIndex: mapPropNamesToIndex(monthStringsReversed.reverse())
    };
  }));
}

function parseIntlYear(intlParts, calendarIdBase) {
  let era, eraYear, year = parseIntlPartsYear(intlParts);
  if (intlParts.era) {
    const eraOrigins = eraOriginsByCalendarId[calendarIdBase];
    void 0 !== eraOrigins && (era = "islamic" === calendarIdBase ? "ah" : intlParts.era.normalize("NFD").toLowerCase().replace(/[^a-z0-9]/g, ""), 
    "bc" === era || "b" === era ? era = "bce" : "ad" !== era && "a" !== era || (era = "ce"), 
    eraYear = year, year = eraYearToYear(eraYear, eraOrigins[era] || 0));
  }
  return {
    era: era,
    eraYear: eraYear,
    year: year
  };
}

function parseIntlPartsYear(intlParts) {
  return parseInt(intlParts.relatedYear || intlParts.year);
}

function computeIntlDateParts(isoFields) {
  const {year: year, monthString: monthString, day: day} = this.queryFields(isoFields), {monthStringToIndex: monthStringToIndex} = this.queryYearData(year);
  return [ year, monthStringToIndex[monthString] + 1, day ];
}

function computeIntlEpochMilli(year, month = 1, day = 1) {
  return this.queryYearData(year).monthEpochMillis[month - 1] + (day - 1) * milliInDay;
}

function computeIntlLeapMonth(year) {
  const currentMonthStrings = queryMonthStrings(this, year), prevMonthStrings = queryMonthStrings(this, year - 1), currentLength = currentMonthStrings.length;
  if (currentLength > prevMonthStrings.length) {
    const leapMonthMeta = getCalendarLeapMonthMeta(this);
    if (leapMonthMeta < 0) {
      return -leapMonthMeta;
    }
    for (let i = 0; i < currentLength; i++) {
      if (currentMonthStrings[i] !== prevMonthStrings[i]) {
        return i + 1;
      }
    }
  }
}

function computeIntlDaysInYear(year) {
  return diffEpochMilliByDay(computeIntlEpochMilli.call(this, year), computeIntlEpochMilli.call(this, year + 1));
}

function computeIntlDaysInMonth(year, month) {
  const {monthEpochMillis: monthEpochMillis} = this.queryYearData(year);
  let nextMonth = month + 1, nextMonthEpochMilli = monthEpochMillis;
  return nextMonth > monthEpochMillis.length && (nextMonth = 1, nextMonthEpochMilli = this.queryYearData(year + 1).monthEpochMillis), 
  diffEpochMilliByDay(monthEpochMillis[month - 1], nextMonthEpochMilli[nextMonth - 1]);
}

function computeIntlMonthsInYear(year) {
  return this.queryYearData(year).monthEpochMillis.length;
}

function queryMonthStrings(intlCalendar, year) {
  return Object.keys(intlCalendar.queryYearData(year).monthStringToIndex);
}

function resolveCalendarId(id) {
  if ((id = id.toLowerCase()) !== isoCalendarId && id !== gregoryCalendarId && computeCalendarIdBase(id) !== computeCalendarIdBase(queryCalendarIntlFormat(id).resolvedOptions().calendar)) {
    throw new RangeError(invalidCalendar(id));
  }
  return id;
}

function computeCalendarIdBase(id) {
  return "islamicc" === id && (id = "islamic"), id.split("-")[0];
}

function computeNativeWeekOfYear(isoFields) {
  return this.weekParts(isoFields)[0];
}

function computeNativeYearOfWeek(isoFields) {
  return this.weekParts(isoFields)[1];
}

function computeNativeDayOfYear(isoFields) {
  const [year] = this.dateParts(isoFields);
  return diffEpochMilliByDay(this.epochMilli(year), isoToEpochMilli(isoFields)) + 1;
}

function parseMonthCode(monthCode) {
  const m = monthCodeRegExp.exec(monthCode);
  if (!m) {
    throw new RangeError(invalidMonthCode(monthCode));
  }
  return [ parseInt(m[1]), Boolean(m[2]) ];
}

function monthCodeNumberToMonth(monthCodeNumber, isLeapMonth, leapMonth) {
  return monthCodeNumber + (isLeapMonth || leapMonth && monthCodeNumber >= leapMonth ? 1 : 0);
}

function monthToMonthCodeNumber(month, leapMonth) {
  return month - (leapMonth && month >= leapMonth ? 1 : 0);
}

function eraYearToYear(eraYear, eraOrigin) {
  return (eraOrigin + eraYear) * (Math.sign(eraOrigin) || 1) || 0;
}

function getCalendarEraOrigins(native) {
  return eraOriginsByCalendarId[getCalendarIdBase(native)];
}

function getCalendarLeapMonthMeta(native) {
  return leapMonthMetas[getCalendarIdBase(native)];
}

function getCalendarIdBase(native) {
  return computeCalendarIdBase(native.id || isoCalendarId);
}

function refineCalendarFields(calendarOps, bag, validFieldNames, requiredFieldNames = [], forcedValidFieldNames = []) {
  return refineFields(bag, [ ...calendarOps.fields(validFieldNames), ...forcedValidFieldNames ].sort(), requiredFieldNames);
}

function refineFields(bag, validFieldNames, requiredFieldNames, disallowEmpty = !requiredFieldNames) {
  const res = {};
  let prevFieldName, anyMatching = 0;
  for (const fieldName of validFieldNames) {
    if (fieldName === prevFieldName) {
      throw new RangeError(duplicateFields(fieldName));
    }
    if ("constructor" === fieldName || "__proto__" === fieldName) {
      throw new RangeError(forbiddenField(fieldName));
    }
    let fieldVal = bag[fieldName];
    if (void 0 !== fieldVal) {
      anyMatching = 1, builtinRefiners[fieldName] && (fieldVal = builtinRefiners[fieldName](fieldVal, fieldName)), 
      res[fieldName] = fieldVal;
    } else if (requiredFieldNames) {
      if (requiredFieldNames.includes(fieldName)) {
        throw new TypeError(missingField(fieldName));
      }
      res[fieldName] = timeFieldDefaults[fieldName];
    }
    prevFieldName = fieldName;
  }
  if (disallowEmpty && !anyMatching) {
    throw new TypeError(noValidFields(validFieldNames));
  }
  return res;
}

function refineTimeBag(fields, overflow) {
  return constrainIsoTimeFields(timeFieldsToIso({
    ...timeFieldDefaults,
    ...fields
  }), overflow);
}

function mergeCalendarFields(calendarOps, obj, bag, validFieldNames, forcedValidFieldNames = [], requiredObjFieldNames = []) {
  const fieldNames = [ ...calendarOps.fields(validFieldNames), ...forcedValidFieldNames ].sort();
  let fields = refineFields(obj, fieldNames, requiredObjFieldNames);
  const partialFields = refineFields(bag, fieldNames);
  return fields = calendarOps.mergeFields(fields, partialFields), refineFields(fields, fieldNames, []);
}

function convertToPlainMonthDay(calendarOps, input) {
  const fields = refineCalendarFields(calendarOps, input, monthCodeDayFieldNames);
  return calendarOps.monthDayFromFields(fields);
}

function convertToPlainYearMonth(calendarOps, input, options) {
  const fields = refineCalendarFields(calendarOps, input, yearMonthCodeFieldNames);
  return calendarOps.yearMonthFromFields(fields, options);
}

function convertToIso(calendarOps, input, inputFieldNames, extra, extraFieldNames) {
  input = pluckProps(inputFieldNames = calendarOps.fields(inputFieldNames), input), 
  extra = refineFields(extra, extraFieldNames = calendarOps.fields(extraFieldNames), []);
  let mergedFields = calendarOps.mergeFields(input, extra);
  return mergedFields = refineFields(mergedFields, [ ...inputFieldNames, ...extraFieldNames ].sort(), []), 
  calendarOps.dateFromFields(mergedFields);
}

function refineYear(calendarNative, fields) {
  let {era: era, eraYear: eraYear, year: year} = fields;
  const eraOrigins = getCalendarEraOrigins(calendarNative);
  if (void 0 !== era || void 0 !== eraYear) {
    if (void 0 === era || void 0 === eraYear) {
      throw new TypeError(mismatchingEraParts);
    }
    if (!eraOrigins) {
      throw new RangeError(forbiddenEraParts);
    }
    const eraOrigin = eraOrigins[era];
    if (void 0 === eraOrigin) {
      throw new RangeError(invalidEra(era));
    }
    const yearByEra = eraYearToYear(eraYear, eraOrigin);
    if (void 0 !== year && year !== yearByEra) {
      throw new RangeError(mismatchingYearAndEra);
    }
    year = yearByEra;
  } else if (void 0 === year) {
    throw new TypeError(missingYear(eraOrigins));
  }
  return year;
}

function refineMonth(calendarNative, fields, year, overflow) {
  let {month: month, monthCode: monthCode} = fields;
  if (void 0 !== monthCode) {
    const monthByCode = ((calendarNative, monthCode, year, overflow) => {
      const leapMonth = calendarNative.leapMonth(year), [monthCodeNumber, wantsLeapMonth] = parseMonthCode(monthCode);
      let month = monthCodeNumberToMonth(monthCodeNumber, wantsLeapMonth, leapMonth);
      if (wantsLeapMonth) {
        const leapMonthMeta = getCalendarLeapMonthMeta(calendarNative);
        if (void 0 === leapMonthMeta) {
          throw new RangeError(invalidLeapMonth);
        }
        if (leapMonthMeta > 0) {
          if (month > leapMonthMeta) {
            throw new RangeError(invalidLeapMonth);
          }
          if (void 0 === leapMonth) {
            if (1 === overflow) {
              throw new RangeError(invalidLeapMonth);
            }
            month--;
          }
        } else {
          if (month !== -leapMonthMeta) {
            throw new RangeError(invalidLeapMonth);
          }
          if (void 0 === leapMonth && 1 === overflow) {
            throw new RangeError(invalidLeapMonth);
          }
        }
      }
      return month;
    })(calendarNative, monthCode, year, overflow);
    if (void 0 !== month && month !== monthByCode) {
      throw new RangeError(mismatchingMonthAndCode);
    }
    month = monthByCode, overflow = 1;
  } else if (void 0 === month) {
    throw new TypeError(missingMonth);
  }
  return clampEntity("month", month, 1, calendarNative.monthsInYearPart(year), overflow);
}

function refineDay(calendarNative, fields, month, year, overflow) {
  return clampProp(fields, "day", 1, calendarNative.daysInMonthParts(year, month), overflow);
}

function spliceFields(dest, additional, allPropNames, deletablePropNames) {
  let anyMatching = 0;
  const nonMatchingPropNames = [];
  for (const propName of allPropNames) {
    void 0 !== additional[propName] ? anyMatching = 1 : nonMatchingPropNames.push(propName);
  }
  if (Object.assign(dest, additional), anyMatching) {
    for (const deletablePropName of deletablePropNames || nonMatchingPropNames) {
      delete dest[deletablePropName];
    }
  }
}

function getPreferredCalendarSlot(a, b) {
  if (a === b) {
    return a;
  }
  const aId = getId(a), bId = getId(b);
  if (aId === bId || aId === isoCalendarId) {
    return b;
  }
  if (bId === isoCalendarId) {
    return a;
  }
  throw new RangeError(mismatchingCalendars);
}

function createOptionsTransformer(standardNames, fallbacks, exclusions) {
  const excludedNameSet = new Set(exclusions);
  return options => (((props, names) => {
    for (const name of names) {
      if (name in props) {
        return 1;
      }
    }
    return 0;
  })(options = excludePropsByName(excludedNameSet, options), standardNames) || Object.assign(options, fallbacks), 
  exclusions && (options.timeZone = utcTimeZoneId, [ "full", "long" ].includes(options.timeStyle) && (options.timeStyle = "medium")), 
  options);
}

function createFormatForPrep(forcedTimeZoneId, locales, options, transformOptions) {
  if (options = transformOptions(options), forcedTimeZoneId) {
    if (void 0 !== options.timeZone) {
      throw new TypeError(forbiddenFormatTimeZone);
    }
    options.timeZone = forcedTimeZoneId;
  }
  return new RawDateTimeFormat(locales, options);
}

function toEpochMillis(config, resolvedOptions, slotsList) {
  const [, slotsToEpochMilli, strictCalendarCheck] = config;
  return slotsList.map((slots => (slots.calendar && ((internalCalendarId, resolvedCalendarId, strictCalendarCheck) => {
    if ((strictCalendarCheck || internalCalendarId !== isoCalendarId) && internalCalendarId !== resolvedCalendarId) {
      throw new RangeError(mismatchingCalendars);
    }
  })(getId(slots.calendar), resolvedOptions.calendar, strictCalendarCheck), slotsToEpochMilli(slots, resolvedOptions))));
}

function getCurrentEpochNano() {
  return numberToBigNano(Date.now(), nanoInMilli);
}

const expectedInteger = (entityName, num) => `Non-integer ${entityName}: ${num}`, expectedPositive = (entityName, num) => `Non-positive ${entityName}: ${num}`, expectedFinite = (entityName, num) => `Non-finite ${entityName}: ${num}`, forbiddenBigIntToNumber = entityName => `Cannot convert bigint to ${entityName}`, invalidBigInt = arg => `Invalid bigint: ${arg}`, forbiddenSymbolToString = "Cannot convert Symbol to string", invalidObject = "Invalid object", numberOutOfRange = (entityName, val, min, max, choices) => choices ? numberOutOfRange(entityName, choices[val], choices[min], choices[max]) : invalidEntity(entityName, val) + `; must be between ${min}-${max}`, invalidEntity = (fieldName, val) => `Invalid ${fieldName}: ${val}`, missingField = fieldName => `Missing ${fieldName}`, forbiddenField = fieldName => `Invalid field ${fieldName}`, duplicateFields = fieldName => `Duplicate field ${fieldName}`, noValidFields = validFields => "No valid fields: " + validFields.join(), invalidChoice = (fieldName, val, choiceMap) => invalidEntity(fieldName, val) + "; must be " + Object.keys(choiceMap).join(), forbiddenEraParts = "Forbidden era/eraYear", mismatchingEraParts = "Mismatching era/eraYear", mismatchingYearAndEra = "Mismatching year/eraYear", invalidEra = era => `Invalid era: ${era}`, missingYear = allowEra => "Missing year" + (allowEra ? "/era/eraYear" : ""), invalidMonthCode = monthCode => `Invalid monthCode: ${monthCode}`, mismatchingMonthAndCode = "Mismatching month/monthCode", missingMonth = "Missing month/monthCode", invalidLeapMonth = "Invalid leap month", invalidProtocolResults = "Invalid protocol results", mismatchingCalendars = "Mismatching Calendars", invalidCalendar = calendarId => `Invalid Calendar: ${calendarId}`, forbiddenIcuTimeZone = "Forbidden ICU TimeZone", outOfBoundsOffset = "Out-of-bounds offset", outOfBoundsDstGap = "Out-of-bounds TimeZone gap", invalidOffsetForTimeZone = "Invalid TimeZone offset", ambigOffset = "Ambiguous offset", outOfBoundsDate = "Out-of-bounds date", outOfBoundsDuration = "Out-of-bounds duration", forbiddenDurationSigns = "Cannot mix duration signs", flippedSmallestLargestUnit = "smallestUnit > largestUnit", failedParse = s => `Cannot parse: ${s}`, invalidSubstring = substring => `Invalid substring: ${substring}`, forbiddenFormatTimeZone = "Cannot specify TimeZone", mapPropNamesToIndex = bindArgs(mapPropNames, ((_propVal, i) => i)), mapPropNamesToConstant = bindArgs(mapPropNames, ((_propVal, _i, constant) => constant)), padNumber2 = bindArgs(padNumber, 2), unitNameMap = {
  nanosecond: 0,
  microsecond: 1,
  millisecond: 2,
  second: 3,
  minute: 4,
  hour: 5,
  day: 6,
  week: 7,
  month: 8,
  year: 9
}, unitNamesAsc = Object.keys(unitNameMap), milliInDay = 864e5, milliInSec = 1e3, nanoInMicro = 1e3, nanoInMilli = 1e6, nanoInSec = 1e9, nanoInMinute = 6e10, nanoInHour = 36e11, nanoInUtcDay = 864e11, unitNanoMap = [ 1, nanoInMicro, nanoInMilli, nanoInSec, nanoInMinute, nanoInHour, nanoInUtcDay ], timeFieldNamesAsc = unitNamesAsc.slice(0, 6), timeFieldNamesAlpha = sortStrings(timeFieldNamesAsc), offsetFieldNames = [ "offset" ], timeZoneFieldNames = [ "timeZone" ], timeAndOffsetFieldNames = [ ...timeFieldNamesAsc, ...offsetFieldNames ], timeAndZoneFieldNames = [ ...timeAndOffsetFieldNames, ...timeZoneFieldNames ], eraYearFieldNames = [ "era", "eraYear" ], allYearFieldNames = [ ...eraYearFieldNames, "year" ], yearFieldNames = [ "year" ], monthCodeFieldNames = [ "monthCode" ], monthFieldNames = [ "month", ...monthCodeFieldNames ], dayFieldNames = [ "day" ], yearMonthFieldNames = [ ...monthFieldNames, ...yearFieldNames ], yearMonthCodeFieldNames = [ ...monthCodeFieldNames, ...yearFieldNames ], dateFieldNamesAlpha = [ ...dayFieldNames, ...yearMonthFieldNames ], monthDayFieldNames = [ ...dayFieldNames, ...monthFieldNames ], monthCodeDayFieldNames = [ ...dayFieldNames, ...monthCodeFieldNames ], timeFieldDefaults = mapPropNamesToConstant(timeFieldNamesAsc, 0), isoCalendarId = "iso8601", gregoryCalendarId = "gregory", eraOriginsByCalendarId = {
  [gregoryCalendarId]: {
    bce: -1,
    ce: 0
  },
  japanese: {
    bce: -1,
    ce: 0,
    meiji: 1867,
    taisho: 1911,
    showa: 1925,
    heisei: 1988,
    reiwa: 2018
  },
  ethioaa: {
    era0: 0
  },
  ethiopic: {
    era0: 0,
    era1: 5500
  },
  coptic: {
    era0: -1,
    era1: 0
  },
  roc: {
    beforeroc: -1,
    minguo: 0
  },
  buddhist: {
    be: 0
  },
  islamic: {
    ah: 0
  },
  indian: {
    saka: 0
  },
  persian: {
    ap: 0
  }
}, leapMonthMetas = {
  chinese: 13,
  dangi: 13,
  hebrew: -6
}, requireString = bindArgs(requireType, "string"), requireBoolean = bindArgs(requireType, "boolean"), requireNumber = bindArgs(requireType, "number"), requireFunction = bindArgs(requireType, "function"), durationFieldNamesAsc = unitNamesAsc.map((unitName => unitName + "s")), durationFieldNamesAlpha = sortStrings(durationFieldNamesAsc), durationTimeFieldNamesAsc = durationFieldNamesAsc.slice(0, 6), durationDateFieldNamesAsc = durationFieldNamesAsc.slice(6), durationCalendarFieldNamesAsc = durationDateFieldNamesAsc.slice(1), durationFieldIndexes = mapPropNamesToIndex(durationFieldNamesAsc), durationFieldDefaults = mapPropNamesToConstant(durationFieldNamesAsc, 0), durationTimeFieldDefaults = mapPropNamesToConstant(durationTimeFieldNamesAsc, 0), clearDurationFields = bindArgs(zeroOutProps, durationFieldNamesAsc), isoTimeFieldNamesAsc = [ "isoNanosecond", "isoMicrosecond", "isoMillisecond", "isoSecond", "isoMinute", "isoHour" ], isoDateFieldNamesAsc = [ "isoDay", "isoMonth", "isoYear" ], isoDateTimeFieldNamesAsc = [ ...isoTimeFieldNamesAsc, ...isoDateFieldNamesAsc ], isoDateFieldNamesAlpha = sortStrings(isoDateFieldNamesAsc), isoTimeFieldNamesAlpha = sortStrings(isoTimeFieldNamesAsc), isoDateTimeFieldNamesAlpha = sortStrings(isoDateTimeFieldNamesAsc), isoTimeFieldDefaults = mapPropNamesToConstant(isoTimeFieldNamesAlpha, 0), clearIsoFields = bindArgs(zeroOutProps, isoDateTimeFieldNamesAsc), RawDateTimeFormat = Intl.DateTimeFormat, maxMilli = 1e8 * milliInDay, epochNanoMax = [ 1e8, 0 ], epochNanoMin = [ -1e8, 0 ], isoYearMax = 275760, isoYearMin = -271821, isoEpochOriginYear = 1970, isoEpochFirstLeapYear = 1972, isoMonthsInYear = 12, primaryJapaneseEraMilli = isoArgsToEpochMilli(1868, 9, 8), queryJapaneseEraParts = memoize((isoFields => {
  const epochMilli = isoToEpochMilli(isoFields);
  if (epochMilli < primaryJapaneseEraMilli) {
    return computeGregoryEraParts(isoFields);
  }
  const intlParts = hashIntlFormatParts(queryCalendarIntlFormat("japanese"), epochMilli), {era: era, eraYear: eraYear} = parseIntlYear(intlParts, "japanese");
  return [ era, eraYear ];
}), WeakMap), smallestUnitStr = "smallestUnit", roundingIncName = "roundingIncrement", subsecDigitsName = "fractionalSecondDigits", overflowMap = {
  constrain: 0,
  reject: 1
}, overflowMapNames = Object.keys(overflowMap), refineSmallestUnit = bindArgs(refineUnitOption, smallestUnitStr), refineLargestUnit = bindArgs(refineUnitOption, "largestUnit"), refineTotalUnit = bindArgs(refineUnitOption, "unit"), refineOverflow = bindArgs(refineChoiceOption, "overflow", overflowMap), refineEpochDisambig = bindArgs(refineChoiceOption, "disambiguation", {
  compatible: 0,
  reject: 1,
  earlier: 2,
  later: 3
}), refineOffsetDisambig = bindArgs(refineChoiceOption, "offset", {
  reject: 0,
  use: 1,
  prefer: 2,
  ignore: 3
}), refineCalendarDisplay = bindArgs(refineChoiceOption, "calendarName", {
  auto: 0,
  never: 1,
  critical: 2,
  always: 3
}), refineTimeZoneDisplay = bindArgs(refineChoiceOption, "timeZoneName", {
  auto: 0,
  never: 1,
  critical: 2
}), refineOffsetDisplay = bindArgs(refineChoiceOption, "offset", {
  auto: 0,
  never: 1
}), refineRoundingMode = bindArgs(refineChoiceOption, "roundingMode", {
  floor: 0,
  halfFloor: 1,
  ceil: 2,
  halfCeil: 3,
  trunc: 4,
  halfTrunc: 5,
  expand: 6,
  halfExpand: 7,
  halfEven: 8
}), PlainYearMonthBranding = "PlainYearMonth", PlainMonthDayBranding = "PlainMonthDay", PlainDateBranding = "PlainDate", PlainDateTimeBranding = "PlainDateTime", PlainTimeBranding = "PlainTime", ZonedDateTimeBranding = "ZonedDateTime", InstantBranding = "Instant", DurationBranding = "Duration", roundingModeFuncs = [ Math.floor, num => hasHalf(num) ? Math.floor(num) : Math.round(num), Math.ceil, num => hasHalf(num) ? Math.ceil(num) : Math.round(num), Math.trunc, num => hasHalf(num) ? Math.trunc(num) || 0 : Math.round(num), num => num < 0 ? Math.floor(num) : Math.ceil(num), num => Math.sign(num) * Math.round(Math.abs(num)) || 0, num => hasHalf(num) ? (num = Math.trunc(num) || 0) + num % 2 : Math.round(num) ], utcTimeZoneId = "UTC", periodDur = 5184e3, minPossibleTransition = isoArgsToEpochSec(1847), maxPossibleTransition = isoArgsToEpochSec((new Date).getUTCFullYear() + 10), trailingZerosRE = /0+$/, zonedEpochSlotsToIso = memoize(((slots, getTimeZoneOps) => {
  const {epochNanoseconds: epochNanoseconds} = slots, offsetNanoseconds = (getTimeZoneOps.getOffsetNanosecondsFor ? getTimeZoneOps : getTimeZoneOps(slots.timeZone)).getOffsetNanosecondsFor(epochNanoseconds), isoDateTimeFields = epochNanoToIso(epochNanoseconds, offsetNanoseconds);
  return {
    calendar: slots.calendar,
    ...isoDateTimeFields,
    offsetNanoseconds: offsetNanoseconds
  };
}), WeakMap), maxCalendarUnit = 2 ** 32 - 1, queryNativeTimeZone = memoize((slotId => {
  const essence = getTimeZoneEssence(slotId);
  return "object" == typeof essence ? new IntlTimeZone(essence) : new FixedTimeZone(essence || 0);
}));

class FixedTimeZone {
  constructor(offsetNano) {
    this.offsetNano = offsetNano;
  }
  getOffsetNanosecondsFor() {
    return this.offsetNano;
  }
  getPossibleInstantsFor(isoDateTimeFields) {
    return [ isoToEpochNanoWithOffset(isoDateTimeFields, this.offsetNano) ];
  }
  getTransition() {}
}

class IntlTimeZone {
  constructor(format) {
    this.tzStore = (computeOffsetSec => {
      function getOffsetSec(epochSec) {
        const clampedEpochSec = clampNumber(epochSec, minTransition, maxTransition), [startEpochSec, endEpochSec] = computePeriod(clampedEpochSec), startOffsetSec = getSample(startEpochSec), endOffsetSec = getSample(endEpochSec);
        return startOffsetSec === endOffsetSec ? startOffsetSec : pinch(getSplit(startEpochSec, endEpochSec), startOffsetSec, endOffsetSec, epochSec);
      }
      function pinch(split, startOffsetSec, endOffsetSec, forEpochSec) {
        let offsetSec, splitDurSec;
        for (;(void 0 === forEpochSec || void 0 === (offsetSec = forEpochSec < split[0] ? startOffsetSec : forEpochSec >= split[1] ? endOffsetSec : void 0)) && (splitDurSec = split[1] - split[0]); ) {
          const middleEpochSec = split[0] + Math.floor(splitDurSec / 2);
          computeOffsetSec(middleEpochSec) === endOffsetSec ? split[1] = middleEpochSec : split[0] = middleEpochSec + 1;
        }
        return offsetSec;
      }
      const getSample = memoize(computeOffsetSec), getSplit = memoize(createSplitTuple);
      let minTransition = minPossibleTransition, maxTransition = maxPossibleTransition;
      return {
        getPossibleEpochSec(zonedEpochSec) {
          const wideOffsetSec0 = getOffsetSec(zonedEpochSec - 86400), wideOffsetSec1 = getOffsetSec(zonedEpochSec + 86400), wideUtcEpochSec0 = zonedEpochSec - wideOffsetSec0, wideUtcEpochSec1 = zonedEpochSec - wideOffsetSec1;
          if (wideOffsetSec0 === wideOffsetSec1) {
            return [ wideUtcEpochSec0 ];
          }
          const narrowOffsetSec0 = getOffsetSec(wideUtcEpochSec0);
          return narrowOffsetSec0 === getOffsetSec(wideUtcEpochSec1) ? [ zonedEpochSec - narrowOffsetSec0 ] : wideOffsetSec0 > wideOffsetSec1 ? [ wideUtcEpochSec0, wideUtcEpochSec1 ] : [];
        },
        getOffsetSec: getOffsetSec,
        getTransition(epochSec, direction) {
          const clampedEpochSec = clampNumber(epochSec, minTransition, maxTransition);
          let [startEpochSec, endEpochSec] = computePeriod(clampedEpochSec);
          const inc = periodDur * direction, inBounds = direction < 0 ? () => endEpochSec > minTransition || (minTransition = clampedEpochSec, 
          0) : () => startEpochSec < maxTransition || (maxTransition = clampedEpochSec, 0);
          for (;inBounds(); ) {
            const startOffsetSec = getSample(startEpochSec), endOffsetSec = getSample(endEpochSec);
            if (startOffsetSec !== endOffsetSec) {
              const split = getSplit(startEpochSec, endEpochSec);
              pinch(split, startOffsetSec, endOffsetSec);
              const transitionEpochSec = split[0];
              if ((compareNumbers(transitionEpochSec, epochSec) || 1) === direction) {
                return transitionEpochSec;
              }
            }
            startEpochSec += inc, endEpochSec += inc;
          }
        }
      };
    })((format => epochSec => {
      const intlParts = hashIntlFormatParts(format, epochSec * milliInSec);
      return isoArgsToEpochSec(parseIntlPartsYear(intlParts), parseInt(intlParts.month), parseInt(intlParts.day), parseInt(intlParts.hour), parseInt(intlParts.minute), parseInt(intlParts.second)) - epochSec;
    })(format));
  }
  getOffsetNanosecondsFor(epochNano) {
    return this.tzStore.getOffsetSec(epochNanoToSec(epochNano)) * nanoInSec;
  }
  getPossibleInstantsFor(isoFields) {
    const [zonedEpochSec, subsecNano] = [ isoArgsToEpochSec((isoDateTimeFields = isoFields).isoYear, isoDateTimeFields.isoMonth, isoDateTimeFields.isoDay, isoDateTimeFields.isoHour, isoDateTimeFields.isoMinute, isoDateTimeFields.isoSecond), isoDateTimeFields.isoMillisecond * nanoInMilli + isoDateTimeFields.isoMicrosecond * nanoInMicro + isoDateTimeFields.isoNanosecond ];
    var isoDateTimeFields;
    return this.tzStore.getPossibleEpochSec(zonedEpochSec).map((epochSec => checkEpochNanoInBounds(moveBigNano(numberToBigNano(epochSec, nanoInSec), subsecNano))));
  }
  getTransition(epochNano, direction) {
    const [epochSec, subsecNano] = epochNanoToSecMod(epochNano), resEpochSec = this.tzStore.getTransition(epochSec + (direction > 0 || subsecNano ? 1 : 0), direction);
    if (void 0 !== resEpochSec) {
      return numberToBigNano(resEpochSec, nanoInSec);
    }
  }
}

const timeRegExpStr = "(\\d{2})(?::?(\\d{2})(?::?(\\d{2})(?:[.,](\\d{1,9}))?)?)?", offsetRegExpStr = "([+−-])" + timeRegExpStr, dateTimeRegExpStr = "(?:(?:([+−-])(\\d{6}))|(\\d{4}))-?(\\d{2})-?(\\d{2})(?:[T ]" + timeRegExpStr + "(Z|" + offsetRegExpStr + ")?)?", yearMonthRegExp = createRegExp("(?:(?:([+−-])(\\d{6}))|(\\d{4}))-?(\\d{2})((?:\\[(!?)([^\\]]*)\\]){0,9})"), monthDayRegExp = createRegExp("(?:--)?(\\d{2})-?(\\d{2})((?:\\[(!?)([^\\]]*)\\]){0,9})"), dateTimeRegExp = createRegExp(dateTimeRegExpStr + "((?:\\[(!?)([^\\]]*)\\]){0,9})"), timeRegExp = createRegExp("T?" + timeRegExpStr + "(?:" + offsetRegExpStr + ")?((?:\\[(!?)([^\\]]*)\\]){0,9})"), offsetRegExp = createRegExp(offsetRegExpStr), annotationRegExp = new RegExp("\\[(!?)([^\\]]*)\\]", "g"), durationRegExp = createRegExp("([+−-])?P(\\d+Y)?(\\d+M)?(\\d+W)?(\\d+D)?(?:T(?:(\\d+)(?:[.,](\\d{1,9}))?H)?(?:(\\d+)(?:[.,](\\d{1,9}))?M)?(?:(\\d+)(?:[.,](\\d{1,9}))?S)?)?"), queryTimeZoneIntlFormat = memoize((id => new RawDateTimeFormat("en-GB", {
  timeZone: id,
  era: "short",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric"
}))), icuRegExp = /^(AC|AE|AG|AR|AS|BE|BS|CA|CN|CS|CT|EA|EC|IE|IS|JS|MI|NE|NS|PL|PN|PR|PS|SS|VS)T$/, queryIntlCalendar = memoize((calendarId => {
  function epochMilliToIntlFields(epochMilli) {
    return ((intlParts, calendarIdBase) => ({
      ...parseIntlYear(intlParts, calendarIdBase),
      monthString: intlParts.month,
      day: parseInt(intlParts.day)
    }))(hashIntlFormatParts(intlFormat, epochMilli), calendarIdBase);
  }
  const intlFormat = queryCalendarIntlFormat(calendarId), calendarIdBase = computeCalendarIdBase(calendarId);
  return {
    id: calendarId,
    queryFields: createIntlFieldCache(epochMilliToIntlFields),
    queryYearData: createIntlYearDataCache(epochMilliToIntlFields)
  };
})), queryCalendarIntlFormat = memoize((id => new RawDateTimeFormat("en-GB", {
  calendar: id,
  timeZone: utcTimeZoneId,
  era: "short",
  year: "numeric",
  month: "short",
  day: "numeric"
}))), monthCodeRegExp = /^M(\d{2})(L?)$/, builtinRefiners = {
  era: toStringViaPrimitive,
  eraYear: toInteger,
  year: toInteger,
  month: toPositiveInteger,
  monthCode: toStringViaPrimitive,
  day: toPositiveInteger,
  ...mapPropNamesToConstant(timeFieldNamesAsc, toInteger),
  ...mapPropNamesToConstant(durationFieldNamesAsc, toStrictInteger),
  offset: toStringViaPrimitive
}, timeFieldsToIso = bindArgs(((oldNames, newNames, oldProps) => {
  const newProps = {};
  for (let i = 0; i < oldNames.length; i++) {
    newProps[newNames[i]] = oldProps[oldNames[i]];
  }
  return newProps;
}), timeFieldNamesAsc, isoTimeFieldNamesAsc), nativeStandardBase = {
  dateAdd(isoDateFields, durationFields, options) {
    const overflow = refineOverflowOptions(options);
    let epochMilli, {years: years, months: months, weeks: weeks, days: days} = durationFields;
    if (days += durationFieldsToBigNano(durationFields, 5)[0], years || months) {
      epochMilli = ((moveOps, isoDateFields, years, months, overflow) => {
        let [year, month, day] = moveOps.dateParts(isoDateFields);
        if (years) {
          const [monthCodeNumber, isLeapMonth] = moveOps.monthCodeParts(year, month);
          year += years, month = monthCodeNumberToMonth(monthCodeNumber, isLeapMonth, moveOps.leapMonth(year)), 
          month = clampEntity("month", month, 1, moveOps.monthsInYearPart(year), overflow);
        }
        return months && ([year, month] = moveOps.monthAdd(year, month, months)), day = clampEntity("day", day, 1, moveOps.daysInMonthParts(year, month), overflow), 
        moveOps.epochMilli(year, month, day);
      })(this, isoDateFields, years, months, overflow);
    } else {
      if (!weeks && !days) {
        return isoDateFields;
      }
      epochMilli = isoToEpochMilli(isoDateFields);
    }
    return epochMilli += (7 * weeks + days) * milliInDay, checkIsoDateInBounds(epochMilliToIso(epochMilli));
  },
  dateUntil(startIsoFields, endIsoFields, largestUnit) {
    if (largestUnit <= 7) {
      let weeks = 0, days = diffDays({
        ...startIsoFields,
        ...isoTimeFieldDefaults
      }, {
        ...endIsoFields,
        ...isoTimeFieldDefaults
      });
      return 7 === largestUnit && ([weeks, days] = divModTrunc(days, 7)), {
        ...durationFieldDefaults,
        weeks: weeks,
        days: days
      };
    }
    const yearMonthDayStart = this.dateParts(startIsoFields), yearMonthDayEnd = this.dateParts(endIsoFields);
    let [years, months, days] = ((calendarNative, year0, month0, day0, year1, month1, day1) => {
      let yearDiff = year1 - year0, monthDiff = month1 - month0, dayDiff = day1 - day0;
      if (yearDiff || monthDiff) {
        const sign = Math.sign(yearDiff || monthDiff);
        let daysInMonth1 = calendarNative.daysInMonthParts(year1, month1), dayCorrect = 0;
        if (Math.sign(dayDiff) === -sign) {
          const origDaysInMonth1 = daysInMonth1;
          [year1, month1] = calendarNative.monthAdd(year1, month1, -sign), yearDiff = year1 - year0, 
          monthDiff = month1 - month0, daysInMonth1 = calendarNative.daysInMonthParts(year1, month1), 
          dayCorrect = sign < 0 ? -origDaysInMonth1 : daysInMonth1;
        }
        if (dayDiff = day1 - Math.min(day0, daysInMonth1) + dayCorrect, yearDiff) {
          const [monthCodeNumber0, isLeapYear0] = calendarNative.monthCodeParts(year0, month0), [monthCodeNumber1, isLeapYear1] = calendarNative.monthCodeParts(year1, month1);
          if (monthDiff = monthCodeNumber1 - monthCodeNumber0 || Number(isLeapYear1) - Number(isLeapYear0), 
          Math.sign(monthDiff) === -sign) {
            const monthCorrect = sign < 0 && -calendarNative.monthsInYearPart(year1);
            yearDiff = (year1 -= sign) - year0, monthDiff = month1 - monthCodeNumberToMonth(monthCodeNumber0, isLeapYear0, calendarNative.leapMonth(year1)) + (monthCorrect || calendarNative.monthsInYearPart(year1));
          }
        }
      }
      return [ yearDiff, monthDiff, dayDiff ];
    })(this, ...yearMonthDayStart, ...yearMonthDayEnd);
    return 8 === largestUnit && (months += this.monthsInYearSpan(years, yearMonthDayStart[0]), 
    years = 0), {
      ...durationFieldDefaults,
      years: years,
      months: months,
      days: days
    };
  },
  dateFromFields(fields, options) {
    const overflow = refineOverflowOptions(options), year = refineYear(this, fields), month = refineMonth(this, fields, year, overflow), day = refineDay(this, fields, month, year, overflow);
    return createPlainDateSlots(checkIsoDateInBounds(this.isoFields(year, month, day)), this.id || isoCalendarId);
  },
  yearMonthFromFields(fields, options) {
    const overflow = refineOverflowOptions(options), year = refineYear(this, fields), month = refineMonth(this, fields, year, overflow);
    return createPlainYearMonthSlots(checkIsoYearMonthInBounds(this.isoFields(year, month, 1)), this.id || isoCalendarId);
  },
  monthDayFromFields(fields, options) {
    const overflow = refineOverflowOptions(options), isIso = !this.id, {monthCode: monthCode, year: year, month: month} = fields;
    let monthCodeNumber, isLeapMonth, normalYear, normalMonth, normalDay;
    if (void 0 !== monthCode) {
      [monthCodeNumber, isLeapMonth] = parseMonthCode(monthCode), normalDay = getDefinedProp(fields, "day");
      const res = this.yearMonthForMonthDay(monthCodeNumber, isLeapMonth, normalDay);
      if (!res) {
        throw new RangeError("Cannot guess year");
      }
      if ([normalYear, normalMonth] = res, void 0 !== month && month !== normalMonth) {
        throw new RangeError(mismatchingMonthAndCode);
      }
      isIso && (normalMonth = clampEntity("month", normalMonth, 1, isoMonthsInYear, 1), 
      normalDay = clampEntity("day", normalDay, 1, computeIsoDaysInMonth(void 0 !== year ? year : normalYear, normalMonth), overflow));
    } else {
      normalYear = void 0 === year && isIso ? isoEpochFirstLeapYear : refineYear(this, fields), 
      normalMonth = refineMonth(this, fields, normalYear, overflow), normalDay = refineDay(this, fields, normalMonth, normalYear, overflow);
      const leapMonth = this.leapMonth(normalYear);
      isLeapMonth = normalMonth === leapMonth, monthCodeNumber = monthToMonthCodeNumber(normalMonth, leapMonth);
      const res = this.yearMonthForMonthDay(monthCodeNumber, isLeapMonth, normalDay);
      if (!res) {
        throw new RangeError("Cannot guess year");
      }
      [normalYear, normalMonth] = res;
    }
    return createPlainMonthDaySlots(checkIsoDateInBounds(this.isoFields(normalYear, normalMonth, normalDay)), this.id || isoCalendarId);
  },
  fields(fieldNames) {
    return getCalendarEraOrigins(this) && fieldNames.includes("year") ? [ ...fieldNames, ...eraYearFieldNames ] : fieldNames;
  },
  mergeFields(baseFields, additionalFields) {
    const merged = Object.assign(Object.create(null), baseFields);
    return spliceFields(merged, additionalFields, monthFieldNames), getCalendarEraOrigins(this) && (spliceFields(merged, additionalFields, allYearFieldNames), 
    "japanese" === this.id && spliceFields(merged, additionalFields, monthDayFieldNames, eraYearFieldNames)), 
    merged;
  },
  inLeapYear(isoFields) {
    const [year] = this.dateParts(isoFields);
    return this.inLeapYearPart(year);
  },
  monthsInYear(isoFields) {
    const [year] = this.dateParts(isoFields);
    return this.monthsInYearPart(year);
  },
  daysInMonth(isoFields) {
    const [year, month] = this.dateParts(isoFields);
    return this.daysInMonthParts(year, month);
  },
  daysInYear(isoFields) {
    const [year] = this.dateParts(isoFields);
    return this.daysInYearPart(year);
  },
  dayOfYear: computeNativeDayOfYear,
  era(isoFields) {
    return this.eraParts(isoFields)[0];
  },
  eraYear(isoFields) {
    return this.eraParts(isoFields)[1];
  },
  monthCode(isoFields) {
    const [year, month] = this.dateParts(isoFields), [monthCodeNumber, isLeapMonth] = this.monthCodeParts(year, month);
    return ((monthCodeNumber, isLeapMonth) => "M" + padNumber2(monthCodeNumber) + (isLeapMonth ? "L" : ""))(monthCodeNumber, isLeapMonth);
  },
  dayOfWeek: computeIsoDayOfWeek,
  daysInWeek() {
    return 7;
  }
}, isoWeekOps = {
  dayOfYear: computeNativeDayOfYear,
  dateParts: computeIsoDateParts,
  epochMilli: isoArgsToEpochMilli,
  weekOfYear: computeNativeWeekOfYear,
  yearOfWeek: computeNativeYearOfWeek,
  weekParts(isoDateFields) {
    function computeWeekShift(yDayOfWeek) {
      return (7 - yDayOfWeek < minDaysInWeek ? 7 : 0) - yDayOfWeek;
    }
    function computeWeeksInYear(delta) {
      const daysInYear = computeIsoDaysInYear(yearOfWeek + delta), sign = delta || 1, y1WeekShift = computeWeekShift(modFloor(y0DayOfWeek + daysInYear * sign, 7));
      return weeksInYear = (daysInYear + (y1WeekShift - y0WeekShift) * sign) / 7;
    }
    const minDaysInWeek = this.id ? 1 : 4, isoDayOfWeek = computeIsoDayOfWeek(isoDateFields), isoDayOfYear = this.dayOfYear(isoDateFields), dayOfWeek = modFloor(isoDayOfWeek - 1, 7), dayOfYear = isoDayOfYear - 1, y0DayOfWeek = modFloor(dayOfWeek - dayOfYear, 7), y0WeekShift = computeWeekShift(y0DayOfWeek);
    let weeksInYear, weekOfYear = Math.floor((dayOfYear - y0WeekShift) / 7) + 1, yearOfWeek = isoDateFields.isoYear;
    return weekOfYear ? weekOfYear > computeWeeksInYear(0) && (weekOfYear = 1, yearOfWeek++) : (weekOfYear = computeWeeksInYear(-1), 
    yearOfWeek--), [ weekOfYear, yearOfWeek, weeksInYear ];
  }
}, isoStandardOps = {
  ...nativeStandardBase,
  ...isoWeekOps,
  dateParts: computeIsoDateParts,
  eraParts(isoFields) {
    return this.id === gregoryCalendarId ? computeGregoryEraParts(isoFields) : "japanese" === this.id ? queryJapaneseEraParts(isoFields) : [];
  },
  monthCodeParts(_isoYear, isoMonth) {
    return [ isoMonth, 0 ];
  },
  yearMonthForMonthDay(monthCodeNumber, isLeapMonth) {
    if (!isLeapMonth) {
      return [ isoEpochFirstLeapYear, monthCodeNumber ];
    }
  },
  inLeapYearPart: computeIsoInLeapYear,
  leapMonth() {},
  monthsInYearPart: computeIsoMonthsInYear,
  monthsInYearSpan: yearDelta => yearDelta * isoMonthsInYear,
  daysInMonthParts: computeIsoDaysInMonth,
  daysInYearPart: computeIsoDaysInYear,
  isoFields(year, month, day) {
    return {
      isoYear: year,
      isoMonth: month,
      isoDay: day
    };
  },
  epochMilli: isoArgsToEpochMilli,
  monthAdd(year, month, monthDelta) {
    return year += divTrunc(monthDelta, isoMonthsInYear), (month += modTrunc(monthDelta, isoMonthsInYear)) < 1 ? (year--, 
    month += isoMonthsInYear) : month > isoMonthsInYear && (year++, month -= isoMonthsInYear), 
    [ year, month ];
  },
  year(isoFields) {
    return isoFields.isoYear;
  },
  month(isoFields) {
    return isoFields.isoMonth;
  },
  day: isoFields => isoFields.isoDay
}, intlWeekOps = {
  dayOfYear: computeNativeDayOfYear,
  dateParts: computeIntlDateParts,
  epochMilli: computeIntlEpochMilli,
  weekOfYear: computeNativeWeekOfYear,
  yearOfWeek: computeNativeYearOfWeek,
  weekParts() {
    return [];
  }
}, intlStandardOps = {
  ...nativeStandardBase,
  ...intlWeekOps,
  dateParts: computeIntlDateParts,
  eraParts(isoFields) {
    const intlFields = this.queryFields(isoFields);
    return [ intlFields.era, intlFields.eraYear ];
  },
  monthCodeParts(year, month) {
    const leapMonth = computeIntlLeapMonth.call(this, year);
    return [ monthToMonthCodeNumber(month, leapMonth), leapMonth === month ];
  },
  yearMonthForMonthDay(monthCodeNumber, isLeapMonth, day) {
    let [startYear, startMonth, startDay] = computeIntlDateParts.call(this, {
      isoYear: isoEpochFirstLeapYear,
      isoMonth: isoMonthsInYear,
      isoDay: 31
    });
    const startYearLeapMonth = computeIntlLeapMonth.call(this, startYear), startMonthIsLeap = startMonth === startYearLeapMonth;
    1 === (compareNumbers(monthCodeNumber, monthToMonthCodeNumber(startMonth, startYearLeapMonth)) || compareNumbers(Number(isLeapMonth), Number(startMonthIsLeap)) || compareNumbers(day, startDay)) && startYear--;
    for (let yearMove = 0; yearMove < 100; yearMove++) {
      const tryYear = startYear - yearMove, tryLeapMonth = computeIntlLeapMonth.call(this, tryYear), tryMonth = monthCodeNumberToMonth(monthCodeNumber, isLeapMonth, tryLeapMonth);
      if (isLeapMonth === (tryMonth === tryLeapMonth) && day <= computeIntlDaysInMonth.call(this, tryYear, tryMonth)) {
        return [ tryYear, tryMonth ];
      }
    }
  },
  inLeapYearPart(year) {
    const days = computeIntlDaysInYear.call(this, year);
    return days > computeIntlDaysInYear.call(this, year - 1) && days > computeIntlDaysInYear.call(this, year + 1);
  },
  leapMonth: computeIntlLeapMonth,
  monthsInYearPart: computeIntlMonthsInYear,
  monthsInYearSpan(yearDelta, yearStart) {
    const yearEnd = yearStart + yearDelta, yearSign = Math.sign(yearDelta), yearCorrection = yearSign < 0 ? -1 : 0;
    let months = 0;
    for (let year = yearStart; year !== yearEnd; year += yearSign) {
      months += computeIntlMonthsInYear.call(this, year + yearCorrection);
    }
    return months;
  },
  daysInMonthParts: computeIntlDaysInMonth,
  daysInYearPart: computeIntlDaysInYear,
  isoFields(year, month, day) {
    return epochMilliToIso(computeIntlEpochMilli.call(this, year, month, day));
  },
  epochMilli: computeIntlEpochMilli,
  monthAdd(year, month, monthDelta) {
    if (monthDelta) {
      if (month += monthDelta, !Number.isSafeInteger(month)) {
        throw new RangeError(outOfBoundsDate);
      }
      if (monthDelta < 0) {
        for (;month < 1; ) {
          month += computeIntlMonthsInYear.call(this, --year);
        }
      } else {
        let monthsInYear;
        for (;month > (monthsInYear = computeIntlMonthsInYear.call(this, year)); ) {
          month -= monthsInYear, year++;
        }
      }
    }
    return [ year, month ];
  },
  year(isoFields) {
    return this.queryFields(isoFields).year;
  },
  month(isoFields) {
    const {year: year, monthString: monthString} = this.queryFields(isoFields), {monthStringToIndex: monthStringToIndex} = this.queryYearData(year);
    return monthStringToIndex[monthString] + 1;
  },
  day(isoFields) {
    return this.queryFields(isoFields).day;
  }
}, createNativeStandardOps = (isoOps = isoStandardOps, intlOps = intlStandardOps, 
calendarId => calendarId === isoCalendarId ? isoOps : calendarId === gregoryCalendarId || "japanese" === calendarId ? Object.assign(Object.create(isoOps), {
  id: calendarId
}) : Object.assign(Object.create(intlOps), queryIntlCalendar(calendarId)));

var isoOps, intlOps;

const timeZoneNameStrs = [ "timeZoneName" ], monthDayFallbacks = {
  month: "numeric",
  day: "numeric"
}, yearMonthFallbacks = {
  year: "numeric",
  month: "numeric"
}, dateFallbacks = {
  ...yearMonthFallbacks,
  day: "numeric"
}, timeFallbacks = {
  hour: "numeric",
  minute: "numeric",
  second: "numeric"
}, dateTimeFallbacks = {
  ...dateFallbacks,
  ...timeFallbacks
}, zonedFallbacks = {
  ...dateTimeFallbacks,
  timeZoneName: "short"
}, yearMonthFallbackNames = Object.keys(yearMonthFallbacks), monthDayFallbackNames = Object.keys(monthDayFallbacks), dateFallbackNames = Object.keys(dateFallbacks), timeFallbackNames = Object.keys(timeFallbacks), dateStyleNames = [ "dateStyle" ], yearMonthStandardNames = [ ...yearMonthFallbackNames, ...dateStyleNames ], monthDayStandardNames = [ ...monthDayFallbackNames, ...dateStyleNames ], dateStandardNames = [ ...dateFallbackNames, ...dateStyleNames, "weekday" ], timeStandardNames = [ ...timeFallbackNames, "dayPeriod", "timeStyle" ], dateTimeStandardNames = [ ...dateStandardNames, ...timeStandardNames ], zonedStandardNames = [ ...dateTimeStandardNames, ...timeZoneNameStrs ], dateExclusions = [ ...timeZoneNameStrs, ...timeStandardNames ], timeExclusions = [ ...timeZoneNameStrs, ...dateStandardNames ], yearMonthExclusions = [ ...timeZoneNameStrs, "day", "weekday", ...timeStandardNames ], monthDayExclusions = [ ...timeZoneNameStrs, "year", "weekday", ...timeStandardNames ], transformInstantOptions = createOptionsTransformer(dateTimeStandardNames, dateTimeFallbacks), transformZonedOptions = createOptionsTransformer(zonedStandardNames, zonedFallbacks), transformDateTimeOptions = createOptionsTransformer(dateTimeStandardNames, dateTimeFallbacks, timeZoneNameStrs), transformDateOptions = createOptionsTransformer(dateStandardNames, dateFallbacks, dateExclusions), transformTimeOptions = createOptionsTransformer(timeStandardNames, timeFallbacks, timeExclusions), transformYearMonthOptions = createOptionsTransformer(yearMonthStandardNames, yearMonthFallbacks, yearMonthExclusions), transformMonthDayOptions = createOptionsTransformer(monthDayStandardNames, monthDayFallbacks, monthDayExclusions), emptyOptions = {}, instantConfig = [ transformInstantOptions, getEpochMilli ], zonedConfig = [ transformZonedOptions, getEpochMilli, 0, (slots0, slots1) => {
  const timeZoneId = getId(slots0.timeZone);
  if (slots1 && getId(slots1.timeZone) !== timeZoneId) {
    throw new RangeError("Mismatching TimeZones");
  }
  return timeZoneId;
} ], dateTimeConfig = [ transformDateTimeOptions, isoToEpochMilli ], dateConfig = [ transformDateOptions, isoToEpochMilli ], timeConfig = [ transformTimeOptions, isoFields => isoTimeFieldsToNano(isoFields) / nanoInMilli ], yearMonthConfig = [ transformYearMonthOptions, isoToEpochMilli, 1 ], monthDayConfig = [ transformMonthDayOptions, isoToEpochMilli, 1 ];

let currentTimeZoneId;

exports.DurationBranding = DurationBranding, exports.InstantBranding = InstantBranding, 
exports.PlainDateBranding = PlainDateBranding, exports.PlainDateTimeBranding = PlainDateTimeBranding, 
exports.PlainMonthDayBranding = PlainMonthDayBranding, exports.PlainTimeBranding = PlainTimeBranding, 
exports.PlainYearMonthBranding = PlainYearMonthBranding, exports.RawDateTimeFormat = RawDateTimeFormat, 
exports.ZonedDateTimeBranding = ZonedDateTimeBranding, exports.absDuration = slots => -1 === slots.sign ? negateDuration(slots) : slots, 
exports.addDurations = (refineRelativeTo, getCalendarOps, getTimeZoneOps, doSubtract, slots, otherSlots, options) => {
  const relativeToSlots = refineRelativeTo(normalizeOptions(options).relativeTo), maxUnit = Math.max(getMaxDurationUnit(slots), getMaxDurationUnit(otherSlots));
  if (isUniformUnit(maxUnit, relativeToSlots)) {
    return createDurationSlots(checkDurationUnits(((a, b, largestUnit, doSubtract) => {
      const combined = addBigNanos(durationFieldsToBigNano(a), durationFieldsToBigNano(b), doSubtract ? -1 : 1);
      if (!Number.isFinite(combined[0])) {
        throw new RangeError(outOfBoundsDate);
      }
      return {
        ...durationFieldDefaults,
        ...nanoToDurationDayTimeFields(combined, largestUnit)
      };
    })(slots, otherSlots, maxUnit, doSubtract)));
  }
  if (!relativeToSlots) {
    throw new RangeError("Missing relativeTo");
  }
  doSubtract && (otherSlots = negateDurationFields(otherSlots));
  const [marker, calendarOps, timeZoneOps] = createMarkerSystem(getCalendarOps, getTimeZoneOps, relativeToSlots), moveMarker = createMoveMarker(timeZoneOps), diffMarkers = createDiffMarkers(timeZoneOps), midMarker = moveMarker(calendarOps, marker, slots);
  return createDurationSlots(diffMarkers(calendarOps, marker, moveMarker(calendarOps, midMarker, otherSlots), maxUnit));
}, exports.bigNanoToNumber = bigNanoToNumber, exports.bindArgs = bindArgs, exports.buildZonedIsoFields = (getTimeZoneOps, zonedDateTimeSlots) => {
  const isoFields = zonedEpochSlotsToIso(zonedDateTimeSlots, getTimeZoneOps);
  return {
    calendar: zonedDateTimeSlots.calendar,
    ...pluckProps(isoDateTimeFieldNamesAlpha, isoFields),
    offset: formatOffsetNano(isoFields.offsetNanoseconds),
    timeZone: zonedDateTimeSlots.timeZone
  };
}, exports.compareBigNanos = compareBigNanos, exports.compareDurations = (refineRelativeTo, getCalendarOps, getTimeZoneOps, durationSlots0, durationSlots1, options) => {
  const relativeToSlots = refineRelativeTo(normalizeOptions(options).relativeTo), maxUnit = Math.max(getMaxDurationUnit(durationSlots0), getMaxDurationUnit(durationSlots1));
  if (allPropsEqual(durationFieldNamesAsc, durationSlots0, durationSlots1)) {
    return 0;
  }
  if (isUniformUnit(maxUnit, relativeToSlots)) {
    return compareBigNanos(durationFieldsToBigNano(durationSlots0), durationFieldsToBigNano(durationSlots1));
  }
  if (!relativeToSlots) {
    throw new RangeError("Missing relativeTo");
  }
  const [marker, calendarOps, timeZoneOps] = createMarkerSystem(getCalendarOps, getTimeZoneOps, relativeToSlots), markerToEpochNano = createMarkerToEpochNano(timeZoneOps), moveMarker = createMoveMarker(timeZoneOps);
  return compareBigNanos(markerToEpochNano(moveMarker(calendarOps, marker, durationSlots0)), markerToEpochNano(moveMarker(calendarOps, marker, durationSlots1)));
}, exports.compareInstants = compareInstants, exports.compareIsoDateFields = compareIsoDateFields, 
exports.compareIsoDateTimeFields = compareIsoDateTimeFields, exports.compareIsoTimeFields = compareIsoTimeFields, 
exports.compareZonedDateTimes = compareZonedDateTimes, exports.computeZonedHoursInDay = (getTimeZoneOps, slots) => {
  const timeZoneOps = getTimeZoneOps(slots.timeZone), isoFields = zonedEpochSlotsToIso(slots, timeZoneOps), [isoFields0, isoFields1] = computeDayInterval(isoFields), hoursExact = bigNanoToNumber(diffBigNanos(getSingleInstantFor(timeZoneOps, isoFields0), getSingleInstantFor(timeZoneOps, isoFields1)), nanoInHour, 1);
  if (hoursExact <= 0) {
    throw new RangeError(invalidProtocolResults);
  }
  return hoursExact;
}, exports.computeZonedStartOfDay = (getTimeZoneOps, slots) => {
  const {timeZone: timeZone, calendar: calendar} = slots;
  return createZonedDateTimeSlots(((computeAlignment, timeZoneOps, slots) => getSingleInstantFor(timeZoneOps, computeAlignment(zonedEpochSlotsToIso(slots, timeZoneOps))))(computeDayFloor, getTimeZoneOps(timeZone), slots), timeZone, calendar);
}, exports.constructDurationSlots = (years = 0, months = 0, weeks = 0, days = 0, hours = 0, minutes = 0, seconds = 0, milliseconds = 0, microseconds = 0, nanoseconds = 0) => createDurationSlots(checkDurationUnits(mapProps(toStrictInteger, zipProps(durationFieldNamesAsc, [ years, months, weeks, days, hours, minutes, seconds, milliseconds, microseconds, nanoseconds ])))), 
exports.constructInstantSlots = epochNano => createInstantSlots(checkEpochNanoInBounds(bigIntToBigNano(toBigInt(epochNano)))), 
exports.constructPlainDateSlots = (refineCalendarArg, isoYear, isoMonth, isoDay, calendarArg = isoCalendarId) => createPlainDateSlots(checkIsoDateInBounds(checkIsoDateFields(mapProps(toInteger, {
  isoYear: isoYear,
  isoMonth: isoMonth,
  isoDay: isoDay
}))), refineCalendarArg(calendarArg)), exports.constructPlainDateTimeSlots = (refineCalendarArg, isoYear, isoMonth, isoDay, isoHour = 0, isoMinute = 0, isoSecond = 0, isoMillisecond = 0, isoMicrosecond = 0, isoNanosecond = 0, calendarArg = isoCalendarId) => createPlainDateTimeSlots(checkIsoDateTimeInBounds(checkIsoDateTimeFields(mapProps(toInteger, zipProps(isoDateTimeFieldNamesAsc, [ isoYear, isoMonth, isoDay, isoHour, isoMinute, isoSecond, isoMillisecond, isoMicrosecond, isoNanosecond ])))), refineCalendarArg(calendarArg)), 
exports.constructPlainMonthDaySlots = (refineCalendarArg, isoMonth, isoDay, calendar = isoCalendarId, referenceIsoYear = isoEpochFirstLeapYear) => {
  const isoMonthInt = toInteger(isoMonth), isoDayInt = toInteger(isoDay), calendarSlot = refineCalendarArg(calendar);
  return createPlainMonthDaySlots(checkIsoDateInBounds(checkIsoDateFields({
    isoYear: toInteger(referenceIsoYear),
    isoMonth: isoMonthInt,
    isoDay: isoDayInt
  })), calendarSlot);
}, exports.constructPlainTimeSlots = (isoHour = 0, isoMinute = 0, isoSecond = 0, isoMillisecond = 0, isoMicrosecond = 0, isoNanosecond = 0) => createPlainTimeSlots(constrainIsoTimeFields(mapProps(toInteger, zipProps(isoTimeFieldNamesAsc, [ isoHour, isoMinute, isoSecond, isoMillisecond, isoMicrosecond, isoNanosecond ])), 1)), 
exports.constructPlainYearMonthSlots = (refineCalendarArg, isoYear, isoMonth, calendar = isoCalendarId, referenceIsoDay = 1) => {
  const isoYearInt = toInteger(isoYear), isoMonthInt = toInteger(isoMonth), calendarSlot = refineCalendarArg(calendar);
  return createPlainYearMonthSlots(checkIsoYearMonthInBounds(checkIsoDateFields({
    isoYear: isoYearInt,
    isoMonth: isoMonthInt,
    isoDay: toInteger(referenceIsoDay)
  })), calendarSlot);
}, exports.constructZonedDateTimeSlots = (refineCalendarArg, refineTimeZoneArg, epochNano, timeZoneArg, calendarArg = isoCalendarId) => createZonedDateTimeSlots(checkEpochNanoInBounds(bigIntToBigNano(toBigInt(epochNano))), refineTimeZoneArg(timeZoneArg), refineCalendarArg(calendarArg)), 
exports.copyOptions = copyOptions, exports.createDurationSlots = createDurationSlots, 
exports.createFormatForPrep = createFormatForPrep, exports.createFormatPrepper = (config, queryFormat = createFormatForPrep) => {
  const [transformOptions, , , getForcedTimeZoneId] = config;
  return (locales, options = emptyOptions, ...slotsList) => {
    const subformat = queryFormat(getForcedTimeZoneId && getForcedTimeZoneId(...slotsList), locales, options, transformOptions), resolvedOptions = subformat.resolvedOptions();
    return [ subformat, ...toEpochMillis(config, resolvedOptions, slotsList) ];
  };
}, exports.createGetterDescriptors = getters => mapProps((getter => ({
  get: getter,
  configurable: 1
})), getters), exports.createInstantSlots = createInstantSlots, exports.createNameDescriptors = name => createPropDescriptors({
  name: name
}, 1), exports.createNativeStandardOps = createNativeStandardOps, exports.createPlainDateSlots = createPlainDateSlots, 
exports.createPlainDateTimeSlots = createPlainDateTimeSlots, exports.createPlainTimeSlots = createPlainTimeSlots, 
exports.createPropDescriptors = createPropDescriptors, exports.createStringTagDescriptors = value => ({
  [Symbol.toStringTag]: {
    value: value,
    configurable: 1
  }
}), exports.createZonedDateTimeSlots = createZonedDateTimeSlots, exports.dateConfig = dateConfig, 
exports.dateFieldNamesAlpha = dateFieldNamesAlpha, exports.dateTimeConfig = dateTimeConfig, 
exports.diffBigNanos = diffBigNanos, exports.diffInstants = (invert, instantSlots0, instantSlots1, options) => {
  const optionsTuple = refineDiffOptions(invert, copyOptions(options), 3, 5), durationFields = diffEpochNanos(instantSlots0.epochNanoseconds, instantSlots1.epochNanoseconds, ...optionsTuple);
  return createDurationSlots(invert ? negateDurationFields(durationFields) : durationFields);
}, exports.diffPlainDateTimes = (getCalendarOps, invert, plainDateTimeSlots0, plainDateTimeSlots1, options) => {
  const calendarSlot = getCommonCalendarSlot(plainDateTimeSlots0.calendar, plainDateTimeSlots1.calendar), optionsCopy = copyOptions(options), [largestUnit, smallestUnit, roundingInc, roundingMode] = refineDiffOptions(invert, optionsCopy, 6), startEpochNano = isoToEpochNano(plainDateTimeSlots0), endEpochNano = isoToEpochNano(plainDateTimeSlots1), sign = compareBigNanos(endEpochNano, startEpochNano);
  let durationFields;
  if (sign) {
    if (largestUnit <= 6) {
      durationFields = diffEpochNanos(startEpochNano, endEpochNano, largestUnit, smallestUnit, roundingInc, roundingMode);
    } else {
      const calendarOps = getCalendarOps(calendarSlot);
      durationFields = diffDateTimesBig(calendarOps, plainDateTimeSlots0, plainDateTimeSlots1, sign, largestUnit, optionsCopy), 
      durationFields = roundRelativeDuration(durationFields, endEpochNano, largestUnit, smallestUnit, roundingInc, roundingMode, calendarOps, plainDateTimeSlots0, isoToEpochNano, moveDateTime);
    }
  } else {
    durationFields = durationFieldDefaults;
  }
  return createDurationSlots(invert ? negateDurationFields(durationFields) : durationFields);
}, exports.diffPlainDates = (getCalendarOps, invert, plainDateSlots0, plainDateSlots1, options) => {
  const calendarSlot = getCommonCalendarSlot(plainDateSlots0.calendar, plainDateSlots1.calendar), optionsCopy = copyOptions(options);
  return diffDateLike(invert, (() => getCalendarOps(calendarSlot)), plainDateSlots0, plainDateSlots1, ...refineDiffOptions(invert, optionsCopy, 6, 9, 6), optionsCopy);
}, exports.diffPlainTimes = (invert, plainTimeSlots0, plainTimeSlots1, options) => {
  const optionsCopy = copyOptions(options), [largestUnit, smallestUnit, roundingInc, roundingMode] = refineDiffOptions(invert, optionsCopy, 5, 5), timeDiffNano = roundByInc(diffTimes(plainTimeSlots0, plainTimeSlots1), computeNanoInc(smallestUnit, roundingInc), roundingMode), durationFields = {
    ...durationFieldDefaults,
    ...nanoToDurationTimeFields(timeDiffNano, largestUnit)
  };
  return createDurationSlots(invert ? negateDurationFields(durationFields) : durationFields);
}, exports.diffPlainYearMonth = (getCalendarOps, invert, plainYearMonthSlots0, plainYearMonthSlots1, options) => {
  const calendarSlot = getCommonCalendarSlot(plainYearMonthSlots0.calendar, plainYearMonthSlots1.calendar), optionsCopy = copyOptions(options), optionsTuple = refineDiffOptions(invert, optionsCopy, 9, 9, 8), calendarOps = getCalendarOps(calendarSlot);
  return diffDateLike(invert, (() => calendarOps), moveToDayOfMonthUnsafe(calendarOps, plainYearMonthSlots0), moveToDayOfMonthUnsafe(calendarOps, plainYearMonthSlots1), ...optionsTuple, optionsCopy);
}, exports.diffZonedDateTimes = (getCalendarOps, getTimeZoneOps, invert, slots0, slots1, options) => {
  const calendarSlot = getCommonCalendarSlot(slots0.calendar, slots1.calendar), optionsCopy = copyOptions(options), [largestUnit, smallestUnit, roundingInc, roundingMode] = refineDiffOptions(invert, optionsCopy, 5), epochNano0 = slots0.epochNanoseconds, epochNano1 = slots1.epochNanoseconds, sign = compareBigNanos(epochNano1, epochNano0);
  let durationFields;
  if (sign) {
    if (largestUnit < 6) {
      durationFields = diffEpochNanos(epochNano0, epochNano1, largestUnit, smallestUnit, roundingInc, roundingMode);
    } else {
      const timeZoneOps = getTimeZoneOps(((a, b) => {
        if (!isTimeZoneSlotsEqual(a, b)) {
          throw new RangeError("Mismatching TimeZones");
        }
        return a;
      })(slots0.timeZone, slots1.timeZone)), calendarOps = getCalendarOps(calendarSlot);
      durationFields = diffZonedEpochsBig(calendarOps, timeZoneOps, slots0, slots1, sign, largestUnit, optionsCopy), 
      durationFields = roundRelativeDuration(durationFields, epochNano1, largestUnit, smallestUnit, roundingInc, roundingMode, calendarOps, slots0, extractEpochNano, bindArgs(moveZonedEpochs, timeZoneOps));
    }
  } else {
    durationFields = durationFieldDefaults;
  }
  return createDurationSlots(invert ? negateDurationFields(durationFields) : durationFields);
}, exports.durationFieldNamesAsc = durationFieldNamesAsc, exports.durationWithFields = (slots, fields) => {
  return createDurationSlots((initialFields = slots, modFields = fields, checkDurationUnits({
    ...initialFields,
    ...refineFields(modFields, durationFieldNamesAlpha)
  })));
  var initialFields, modFields;
}, exports.epochMicroToInstant = epochMicro => createInstantSlots(checkEpochNanoInBounds(bigIntToBigNano(toBigInt(epochMicro), nanoInMicro))), 
exports.epochMilliToInstant = epochMilli => createInstantSlots(checkEpochNanoInBounds(numberToBigNano(epochMilli, nanoInMilli))), 
exports.epochNanoToInstant = epochNano => createInstantSlots(checkEpochNanoInBounds(bigIntToBigNano(toBigInt(epochNano)))), 
exports.epochNanoToIso = epochNanoToIso, exports.epochSecToInstant = epochSec => createInstantSlots(checkEpochNanoInBounds(numberToBigNano(epochSec, nanoInSec))), 
exports.excludePropsByName = excludePropsByName, exports.excludeUndefinedProps = props => {
  props = {
    ...props
  };
  const propNames = Object.keys(props);
  for (const propName of propNames) {
    void 0 === props[propName] && delete props[propName];
  }
  return props;
}, exports.forbiddenField = forbiddenField, exports.forbiddenValueOf = "Cannot use valueOf", 
exports.formatDurationIso = (slots, options) => {
  const [roundingMode, nanoInc, subsecDigits] = refineTimeDisplayOptions(options, 3);
  return nanoInc > 1 && (slots = {
    ...slots,
    ...roundDayTimeDurationByInc(slots, nanoInc, roundingMode)
  }), ((durationSlots, subsecDigits) => {
    const {sign: sign} = durationSlots, abs = -1 === sign ? negateDurationFields(durationSlots) : durationSlots, {hours: hours, minutes: minutes} = abs, [wholeSec, subsecNano] = divModBigNano(durationFieldsToBigNano(abs, 3), nanoInSec, divModTrunc);
    checkDurationTimeUnit(wholeSec);
    const subsecNanoString = formatSubsecNano(subsecNano, subsecDigits), forceSec = subsecDigits >= 0 || !sign || subsecNanoString;
    return (sign < 0 ? "-" : "") + "P" + formatDurationFragments({
      Y: formatDurationNumber(abs.years),
      M: formatDurationNumber(abs.months),
      W: formatDurationNumber(abs.weeks),
      D: formatDurationNumber(abs.days)
    }) + (hours || minutes || wholeSec || forceSec ? "T" + formatDurationFragments({
      H: formatDurationNumber(hours),
      M: formatDurationNumber(minutes),
      S: formatDurationNumber(wholeSec, forceSec) + subsecNanoString
    }) : "");
  })(slots, subsecDigits);
}, exports.formatInstantIso = (refineTimeZoneArg, getTimeZoneOps, instantSlots, options) => {
  const [timeZoneArg, roundingMode, nanoInc, subsecDigits] = (options => {
    const timeDisplayTuple = refineTimeDisplayTuple(options = normalizeOptions(options));
    return [ options.timeZone, ...timeDisplayTuple ];
  })(options), providedTimeZone = void 0 !== timeZoneArg;
  return ((providedTimeZone, timeZoneOps, epochNano, roundingMode, nanoInc, subsecDigits) => {
    epochNano = roundBigNanoByInc(epochNano, nanoInc, roundingMode, 1);
    const offsetNano = timeZoneOps.getOffsetNanosecondsFor(epochNano);
    return formatIsoDateTimeFields(epochNanoToIso(epochNano, offsetNano), subsecDigits) + (providedTimeZone ? formatOffsetNano(roundToMinute(offsetNano)) : "Z");
  })(providedTimeZone, getTimeZoneOps(providedTimeZone ? refineTimeZoneArg(timeZoneArg) : utcTimeZoneId), instantSlots.epochNanoseconds, roundingMode, nanoInc, subsecDigits);
}, exports.formatOffsetNano = formatOffsetNano, exports.formatPlainDateIso = (plainDateSlots, options) => {
  return calendarIdLike = plainDateSlots.calendar, isoFields = plainDateSlots, calendarDisplay = refineDateDisplayOptions(options), 
  formatIsoDateFields(isoFields) + formatCalendar(calendarIdLike, calendarDisplay);
  var calendarIdLike, isoFields, calendarDisplay;
}, exports.formatPlainDateTimeIso = (plainDateTimeSlots0, options) => {
  const [a, b, c, d] = (options => (options = normalizeOptions(options), [ refineCalendarDisplay(options), ...refineTimeDisplayTuple(options) ]))(options);
  return calendarIdLike = plainDateTimeSlots0.calendar, calendarDisplay = a, subsecDigits = d, 
  formatIsoDateTimeFields(roundDateTimeToNano(plainDateTimeSlots0, c, b), subsecDigits) + formatCalendar(calendarIdLike, calendarDisplay);
  var calendarIdLike, calendarDisplay, subsecDigits;
}, exports.formatPlainMonthDayIso = (plainMonthDaySlots, options) => formatDateLikeIso(plainMonthDaySlots.calendar, formatIsoMonthDayFields, plainMonthDaySlots, refineDateDisplayOptions(options)), 
exports.formatPlainTimeIso = (slots, options) => {
  const [a, b, c] = refineTimeDisplayOptions(options);
  return subsecDigits = c, formatIsoTimeFields(roundTimeToNano(slots, b, a)[0], subsecDigits);
  var subsecDigits;
}, exports.formatPlainYearMonthIso = (plainYearMonthSlots, options) => formatDateLikeIso(plainYearMonthSlots.calendar, formatIsoYearMonthFields, plainYearMonthSlots, refineDateDisplayOptions(options)), 
exports.formatZonedDateTimeIso = (getTimeZoneOps, zonedDateTimeSlots0, options) => {
  const [a, b, c, d, e, f] = (options => {
    options = normalizeOptions(options);
    const calendarDisplay = refineCalendarDisplay(options), subsecDigits = refineSubsecDigits(options), offsetDisplay = refineOffsetDisplay(options), roundingMode = refineRoundingMode(options, 4), smallestUnit = refineSmallestUnit(options, 4);
    return [ calendarDisplay, refineTimeZoneDisplay(options), offsetDisplay, roundingMode, ...refineSmallestUnitAndSubsecDigits(smallestUnit, subsecDigits) ];
  })(options);
  return ((getTimeZoneOps, calendarSlot, timeZoneSlot, epochNano, calendarDisplay, timeZoneDisplay, offsetDisplay, roundingMode, nanoInc, subsecDigits) => {
    epochNano = roundBigNanoByInc(epochNano, nanoInc, roundingMode, 1);
    const offsetNano = getTimeZoneOps(timeZoneSlot).getOffsetNanosecondsFor(epochNano);
    return formatIsoDateTimeFields(epochNanoToIso(epochNano, offsetNano), subsecDigits) + formatOffsetNano(roundToMinute(offsetNano), offsetDisplay) + ((timeZoneNative, timeZoneDisplay) => 1 !== timeZoneDisplay ? "[" + (2 === timeZoneDisplay ? "!" : "") + getId(timeZoneNative) + "]" : "")(timeZoneSlot, timeZoneDisplay) + formatCalendar(calendarSlot, calendarDisplay);
  })(getTimeZoneOps, zonedDateTimeSlots0.calendar, zonedDateTimeSlots0.timeZone, zonedDateTimeSlots0.epochNanoseconds, a, b, c, d, e, f);
}, exports.getCurrentEpochNano = getCurrentEpochNano, exports.getCurrentIsoDateTime = timeZoneOps => {
  const epochNano = getCurrentEpochNano();
  return epochNanoToIso(epochNano, timeZoneOps.getOffsetNanosecondsFor(epochNano));
}, exports.getCurrentTimeZoneId = () => currentTimeZoneId || (currentTimeZoneId = (new RawDateTimeFormat).resolvedOptions().timeZone), 
exports.getDurationBlank = slots => !slots.sign, exports.getEpochMicro = slots => bigNanoToBigInt(slots.epochNanoseconds, nanoInMicro), 
exports.getEpochMilli = getEpochMilli, exports.getEpochNano = slots => bigNanoToBigInt(slots.epochNanoseconds), 
exports.getEpochSec = slots => epochNanoToSec(slots.epochNanoseconds), exports.getId = getId, 
exports.getRequiredDateFields = calendarId => calendarId === isoCalendarId ? [ "year", "day" ] : [], 
exports.getRequiredMonthDayFields = calendarId => calendarId === isoCalendarId ? dayFieldNames : [], 
exports.getRequiredYearMonthFields = calendarId => calendarId === isoCalendarId ? yearFieldNames : [], 
exports.getSingleInstantFor = getSingleInstantFor, exports.hasAllPropsByName = (props, names) => {
  for (const name of names) {
    if (!(name in props)) {
      return 0;
    }
  }
  return 1;
}, exports.instantConfig = instantConfig, exports.instantToZonedDateTime = (instantSlots, timeZoneSlot, calendarSlot = isoCalendarId) => createZonedDateTimeSlots(instantSlots.epochNanoseconds, timeZoneSlot, calendarSlot), 
exports.instantsEqual = (instantSlots0, instantSlots1) => !compareInstants(instantSlots0, instantSlots1), 
exports.invalidBag = "Invalid bag", exports.invalidCallingContext = "Invalid calling context", 
exports.invalidFormatType = branding => `Cannot format ${branding}`, exports.invalidProtocol = "Invalid protocol", 
exports.isObjectLike = isObjectLike, exports.isTimeZoneSlotsEqual = isTimeZoneSlotsEqual, 
exports.isoCalendarId = isoCalendarId, exports.isoTimeFieldDefaults = isoTimeFieldDefaults, 
exports.isoTimeFieldNamesAsc = isoTimeFieldNamesAsc, exports.mapPropNames = mapPropNames, 
exports.mapProps = mapProps, exports.memoize = memoize, exports.mismatchingFormatTypes = "Mismatching types for formatting", 
exports.monthDayConfig = monthDayConfig, exports.moveInstant = (doSubtract, instantSlots, durationSlots) => createInstantSlots(checkEpochNanoInBounds(addBigNanos(instantSlots.epochNanoseconds, (fields => {
  if (durationHasDateParts(fields)) {
    throw new RangeError("Cannot use large units");
  }
  return durationFieldsToBigNano(fields, 5);
})(doSubtract ? negateDurationFields(durationSlots) : durationSlots)))), exports.movePlainDate = (getCalendarOps, doSubtract, plainDateSlots, durationSlots, options) => {
  const {calendar: calendar} = plainDateSlots;
  return createPlainDateSlots(moveDate(getCalendarOps(calendar), plainDateSlots, doSubtract ? negateDurationFields(durationSlots) : durationSlots, options), calendar);
}, exports.movePlainDateTime = (getCalendarOps, doSubtract, plainDateTimeSlots, durationSlots, options = Object.create(null)) => {
  const {calendar: calendar} = plainDateTimeSlots;
  return createPlainDateTimeSlots(moveDateTime(getCalendarOps(calendar), plainDateTimeSlots, doSubtract ? negateDurationFields(durationSlots) : durationSlots, options), calendar);
}, exports.movePlainTime = (doSubtract, slots, durationSlots) => createPlainTimeSlots(moveTime(slots, doSubtract ? negateDurationFields(durationSlots) : durationSlots)[0]), 
exports.movePlainYearMonth = (getCalendarOps, doSubtract, plainYearMonthSlots, durationSlots, options = Object.create(null)) => {
  const calendarSlot = plainYearMonthSlots.calendar, calendarOps = getCalendarOps(calendarSlot);
  let isoDateFields = moveToDayOfMonthUnsafe(calendarOps, plainYearMonthSlots);
  doSubtract && (durationSlots = negateDuration(durationSlots)), durationSlots.sign < 0 && (isoDateFields = calendarOps.dateAdd(isoDateFields, {
    ...durationFieldDefaults,
    months: 1
  }), isoDateFields = moveByDays(isoDateFields, -1));
  const movedIsoDateFields = calendarOps.dateAdd(isoDateFields, durationSlots, options);
  return createPlainYearMonthSlots(moveToDayOfMonthUnsafe(calendarOps, movedIsoDateFields), calendarSlot);
}, exports.moveZonedDateTime = (getCalendarOps, getTimeZoneOps, doSubtract, zonedDateTimeSlots, durationSlots, options = Object.create(null)) => {
  const timeZoneOps = getTimeZoneOps(zonedDateTimeSlots.timeZone), calendarOps = getCalendarOps(zonedDateTimeSlots.calendar);
  return {
    ...zonedDateTimeSlots,
    ...moveZonedEpochs(timeZoneOps, calendarOps, zonedDateTimeSlots, doSubtract ? negateDurationFields(durationSlots) : durationSlots, options)
  };
}, exports.nanoInMilli = nanoInMilli, exports.negateDuration = negateDuration, exports.numberToBigNano = numberToBigNano, 
exports.parseCalendarId = s => {
  const res = parseDateTimeLike(s) || parseYearMonthOnly(s) || parseMonthDayOnly(s);
  return res ? res.calendar : s;
}, exports.parseDuration = s => {
  const parsed = (s => {
    const parts = durationRegExp.exec(s);
    return parts ? (parts => {
      function parseUnit(wholeStr, fracStr, timeUnit) {
        let leftoverUnits = 0, wholeUnits = 0;
        if (timeUnit && ([leftoverUnits, leftoverNano] = divModFloor(leftoverNano, unitNanoMap[timeUnit])), 
        void 0 !== wholeStr) {
          if (hasAnyFrac) {
            throw new RangeError(invalidSubstring(wholeStr));
          }
          wholeUnits = (s => {
            const n = parseInt(s);
            if (!Number.isFinite(n)) {
              throw new RangeError(invalidSubstring(s));
            }
            return n;
          })(wholeStr), hasAny = 1, fracStr && (leftoverNano = parseSubsecNano(fracStr) * (unitNanoMap[timeUnit] / nanoInSec), 
          hasAnyFrac = 1);
        }
        return leftoverUnits + wholeUnits;
      }
      let hasAny = 0, hasAnyFrac = 0, leftoverNano = 0, durationFields = {
        ...zipProps(durationFieldNamesAsc, [ parseUnit(parts[2]), parseUnit(parts[3]), parseUnit(parts[4]), parseUnit(parts[5]), parseUnit(parts[6], parts[7], 5), parseUnit(parts[8], parts[9], 4), parseUnit(parts[10], parts[11], 3) ]),
        ...nanoToGivenFields(leftoverNano, 2, durationFieldNamesAsc)
      };
      if (!hasAny) {
        throw new RangeError(noValidFields(durationFieldNamesAsc));
      }
      return parseSign(parts[1]) < 0 && (durationFields = negateDurationFields(durationFields)), 
      durationFields;
    })(parts) : void 0;
  })(requireString(s));
  if (!parsed) {
    throw new RangeError(failedParse(s));
  }
  return createDurationSlots(checkDurationUnits(parsed));
}, exports.parseInstant = s => {
  const organized = parseDateTimeLike(s = toStringViaPrimitive(s));
  if (!organized) {
    throw new RangeError(failedParse(s));
  }
  let offsetNano;
  if (organized.hasZ) {
    offsetNano = 0;
  } else {
    if (!organized.offset) {
      throw new RangeError(failedParse(s));
    }
    offsetNano = parseOffsetNano(organized.offset);
  }
  return organized.timeZone && parseOffsetNanoMaybe(organized.timeZone, 1), createInstantSlots(isoToEpochNanoWithOffset(checkIsoDateTimeFields(organized), offsetNano));
}, exports.parsePlainDate = parsePlainDate, exports.parsePlainDateTime = s => {
  const organized = parseDateTimeLike(requireString(s));
  if (!organized || organized.hasZ) {
    throw new RangeError(failedParse(s));
  }
  return createPlainDateTimeSlots(finalizeDateTime(organized));
}, exports.parsePlainMonthDay = (getCalendarOps, s) => {
  const organized = parseMonthDayOnly(requireString(s));
  if (organized) {
    return requireIsoCalendar(organized), createPlainMonthDaySlots(checkIsoDateFields(organized));
  }
  const dateSlots = parsePlainDate(s), {calendar: calendar} = dateSlots, calendarOps = getCalendarOps(calendar), [origYear, origMonth, day] = calendarOps.dateParts(dateSlots), [monthCodeNumber, isLeapMonth] = calendarOps.monthCodeParts(origYear, origMonth), [year, month] = calendarOps.yearMonthForMonthDay(monthCodeNumber, isLeapMonth, day);
  return createPlainMonthDaySlots(checkIsoDateInBounds(calendarOps.isoFields(year, month, day)), calendar);
}, exports.parsePlainTime = s => {
  let altParsed, organized = (s => {
    const parts = timeRegExp.exec(s);
    return parts ? (organizeAnnotationParts(parts[10]), organizeTimeParts(parts)) : void 0;
  })(requireString(s));
  if (!organized) {
    if (organized = parseDateTimeLike(s), !organized) {
      throw new RangeError(failedParse(s));
    }
    if (!organized.hasTime) {
      throw new RangeError(failedParse(s));
    }
    if (organized.hasZ) {
      throw new RangeError(invalidSubstring("Z"));
    }
    requireIsoCalendar(organized);
  }
  if ((altParsed = parseYearMonthOnly(s)) && isIsoDateFieldsValid(altParsed)) {
    throw new RangeError(failedParse(s));
  }
  if ((altParsed = parseMonthDayOnly(s)) && isIsoDateFieldsValid(altParsed)) {
    throw new RangeError(failedParse(s));
  }
  return createPlainTimeSlots(constrainIsoTimeFields(organized, 1));
}, exports.parsePlainYearMonth = (getCalendarOps, s) => {
  const organized = parseYearMonthOnly(requireString(s));
  if (organized) {
    return requireIsoCalendar(organized), createPlainYearMonthSlots(checkIsoYearMonthInBounds(checkIsoDateFields(organized)));
  }
  const isoSlots = parsePlainDate(s);
  return createPlainYearMonthSlots(moveToDayOfMonthUnsafe(getCalendarOps(isoSlots.calendar), isoSlots));
}, exports.parseRelativeToSlots = s => {
  const organized = parseDateTimeLike(requireString(s));
  if (!organized) {
    throw new RangeError(failedParse(s));
  }
  if (organized.timeZone) {
    return finalizeZonedDateTime(organized, organized.offset ? parseOffsetNano(organized.offset) : void 0);
  }
  if (organized.hasZ) {
    throw new RangeError(failedParse(s));
  }
  return finalizeDate(organized);
}, exports.parseTimeZoneId = s => {
  const parsed = parseDateTimeLike(s);
  return parsed && (parsed.timeZone || parsed.hasZ && utcTimeZoneId || parsed.offset) || s;
}, exports.parseZonedDateTime = (s, options) => {
  const organized = parseDateTimeLike(requireString(s));
  if (!organized || !organized.timeZone) {
    throw new RangeError(failedParse(s));
  }
  const {offset: offset} = organized, offsetNano = offset ? parseOffsetNano(offset) : void 0, [, offsetDisambig, epochDisambig] = refineZonedFieldOptions(options);
  return finalizeZonedDateTime(organized, offsetNano, offsetDisambig, epochDisambig);
}, exports.plainDateTimeToPlainMonthDay = (getCalendarOps, plainDateTimeSlots, plainDateFields) => convertToPlainMonthDay(getCalendarOps(plainDateTimeSlots.calendar), plainDateFields), 
exports.plainDateTimeToPlainYearMonth = (getCalendarOps, plainDateTimeSlots, plainDateFields) => {
  const calendarOps = getCalendarOps(plainDateTimeSlots.calendar);
  return createPlainYearMonthSlots({
    ...plainDateTimeSlots,
    ...convertToPlainYearMonth(calendarOps, plainDateFields)
  });
}, exports.plainDateTimeToZonedDateTime = (getTimeZoneOps, plainDateTimeSlots, timeZoneSlot, options) => createZonedDateTimeSlots(checkEpochNanoInBounds(((getTimeZoneOps, timeZoneSlot, isoFields, options) => {
  const epochDisambig = refineEpochDisambigOptions(options);
  return getSingleInstantFor(getTimeZoneOps(timeZoneSlot), isoFields, epochDisambig);
})(getTimeZoneOps, timeZoneSlot, plainDateTimeSlots, options)), timeZoneSlot, plainDateTimeSlots.calendar), 
exports.plainDateTimeWithFields = (getCalendarOps, plainDateTimeSlots, initialFields, modFields, options) => {
  const optionsCopy = copyOptions(options);
  return createPlainDateTimeSlots(((calendarOps, initialFields, modFields, options) => {
    const fields = mergeCalendarFields(calendarOps, initialFields, modFields, dateFieldNamesAlpha, timeFieldNamesAsc), overflow = refineOverflowOptions(options);
    return checkIsoDateTimeInBounds({
      ...calendarOps.dateFromFields(fields, overrideOverflowOptions(options, overflow)),
      ...refineTimeBag(fields, overflow)
    });
  })(getCalendarOps(plainDateTimeSlots.calendar), initialFields, modFields, optionsCopy));
}, exports.plainDateTimeWithPlainDate = (plainDateTimeSlots, plainDateSlots) => createPlainDateTimeSlots({
  ...plainDateTimeSlots,
  ...plainDateSlots
}, getPreferredCalendarSlot(plainDateTimeSlots.calendar, plainDateSlots.calendar)), 
exports.plainDateTimeWithPlainTime = (plainDateTimeSlots, plainTimeSlots = isoTimeFieldDefaults) => createPlainDateTimeSlots({
  ...plainDateTimeSlots,
  ...plainTimeSlots
}), exports.plainDateTimesEqual = (plainDateTimeSlots0, plainDateTimeSlots1) => !compareIsoDateTimeFields(plainDateTimeSlots0, plainDateTimeSlots1) && isIdLikeEqual(plainDateTimeSlots0.calendar, plainDateTimeSlots1.calendar), 
exports.plainDateToPlainDateTime = (plainDateSlots, plainTimeFields = isoTimeFieldDefaults) => createPlainDateTimeSlots(checkIsoDateTimeInBounds({
  ...plainDateSlots,
  ...plainTimeFields
})), exports.plainDateToPlainMonthDay = (getCalendarOps, plainDateSlots, plainDateFields) => convertToPlainMonthDay(getCalendarOps(plainDateSlots.calendar), plainDateFields), 
exports.plainDateToPlainYearMonth = (getCalendarOps, plainDateSlots, plainDateFields) => convertToPlainYearMonth(getCalendarOps(plainDateSlots.calendar), plainDateFields), 
exports.plainDateToZonedDateTime = (refineTimeZoneArg, refinePlainTimeArg, getTimeZoneOps, plainDateSlots, options) => {
  const timeZoneSlot = refineTimeZoneArg(options.timeZone), plainTimeArg = options.plainTime, isoTimeFields = void 0 !== plainTimeArg ? refinePlainTimeArg(plainTimeArg) : isoTimeFieldDefaults;
  return createZonedDateTimeSlots(getSingleInstantFor(getTimeZoneOps(timeZoneSlot), {
    ...plainDateSlots,
    ...isoTimeFields
  }), timeZoneSlot, plainDateSlots.calendar);
}, exports.plainDateWithFields = (getCalendarOps, plainDateSlots, initialFields, modFields, options) => {
  const optionsCopy = copyOptions(options);
  return ((calendarOps, initialFields, modFields, options) => {
    const fields = mergeCalendarFields(calendarOps, initialFields, modFields, dateFieldNamesAlpha);
    return calendarOps.dateFromFields(fields, options);
  })(getCalendarOps(plainDateSlots.calendar), initialFields, modFields, optionsCopy);
}, exports.plainDatesEqual = (plainDateSlots0, plainDateSlots1) => !compareIsoDateFields(plainDateSlots0, plainDateSlots1) && isIdLikeEqual(plainDateSlots0.calendar, plainDateSlots1.calendar), 
exports.plainMonthDayToPlainDate = (getCalendarOps, plainMonthDaySlots, plainMonthDayFields, bag) => ((calendarOps, input, bag) => convertToIso(calendarOps, input, monthCodeDayFieldNames, requireObjectLike(bag), yearFieldNames))(getCalendarOps(plainMonthDaySlots.calendar), plainMonthDayFields, bag), 
exports.plainMonthDayWithFields = (getCalendarOps, plainMonthDaySlots, initialFields, modFields, options) => {
  const optionsCopy = copyOptions(options);
  return ((calendarOps, initialFields, modFields, options) => {
    const fields = mergeCalendarFields(calendarOps, initialFields, modFields, dateFieldNamesAlpha);
    return calendarOps.monthDayFromFields(fields, options);
  })(getCalendarOps(plainMonthDaySlots.calendar), initialFields, modFields, optionsCopy);
}, exports.plainMonthDaysEqual = (plainMonthDaySlots0, plainMonthDaySlots1) => !compareIsoDateFields(plainMonthDaySlots0, plainMonthDaySlots1) && isIdLikeEqual(plainMonthDaySlots0.calendar, plainMonthDaySlots1.calendar), 
exports.plainTimeToPlainDateTime = (plainTimeSlots0, plainDateSlots1) => createPlainDateTimeSlots(checkIsoDateTimeInBounds({
  ...plainTimeSlots0,
  ...plainDateSlots1
})), exports.plainTimeToZonedDateTime = (refineTimeZoneArg, refinePlainDateArg, getTimeZoneOps, slots, options) => {
  const refinedOptions = requireObjectLike(options), plainDateSlots = refinePlainDateArg(refinedOptions.plainDate), timeZoneSlot = refineTimeZoneArg(refinedOptions.timeZone);
  return createZonedDateTimeSlots(getSingleInstantFor(getTimeZoneOps(timeZoneSlot), {
    ...plainDateSlots,
    ...slots
  }), timeZoneSlot, plainDateSlots.calendar);
}, exports.plainTimeWithFields = (initialFields, mod, options) => createPlainTimeSlots(((initialFields, modFields, options) => {
  const overflow = refineOverflowOptions(options);
  return refineTimeBag({
    ...pluckProps(timeFieldNamesAlpha, initialFields),
    ...refineFields(modFields, timeFieldNamesAlpha)
  }, overflow);
})(initialFields, mod, options)), exports.plainTimesEqual = (plainTimeSlots0, plainTimeSlots1) => !compareIsoTimeFields(plainTimeSlots0, plainTimeSlots1), 
exports.plainYearMonthToPlainDate = (getCalendarOps, plainYearMonthSlots, plainYearMonthFields, bag) => ((calendarOps, input, bag) => convertToIso(calendarOps, input, yearMonthCodeFieldNames, requireObjectLike(bag), dayFieldNames))(getCalendarOps(plainYearMonthSlots.calendar), plainYearMonthFields, bag), 
exports.plainYearMonthWithFields = (getCalendarOps, plainYearMonthSlots, initialFields, modFields, options) => {
  const optionsCopy = copyOptions(options);
  return createPlainYearMonthSlots(((calendarOps, initialFields, modFields, options) => {
    const fields = mergeCalendarFields(calendarOps, initialFields, modFields, yearMonthFieldNames);
    return calendarOps.yearMonthFromFields(fields, options);
  })(getCalendarOps(plainYearMonthSlots.calendar), initialFields, modFields, optionsCopy));
}, exports.plainYearMonthsEqual = (plainYearMonthSlots0, plainYearMonthSlots1) => !compareIsoDateFields(plainYearMonthSlots0, plainYearMonthSlots1) && isIdLikeEqual(plainYearMonthSlots0.calendar, plainYearMonthSlots1.calendar), 
exports.pluckProps = pluckProps, exports.queryNativeTimeZone = queryNativeTimeZone, 
exports.refineCalendarId = id => resolveCalendarId(requireString(id)), exports.refineDateDiffOptions = options => (options = normalizeOptions(options), 
refineLargestUnit(options, 9, 6, 1)), exports.refineDurationBag = bag => {
  const durationFields = refineFields(bag, durationFieldNamesAlpha);
  return createDurationSlots(checkDurationUnits({
    ...durationFieldDefaults,
    ...durationFields
  }));
}, exports.refineEpochDisambigOptions = refineEpochDisambigOptions, exports.refineMaybeZonedDateTimeBag = (refineTimeZoneArg, getTimeZoneOps, calendarOps, bag) => {
  const fields = refineCalendarFields(calendarOps, bag, dateFieldNamesAlpha, [], timeAndZoneFieldNames);
  if (void 0 !== fields.timeZone) {
    const isoDateFields = calendarOps.dateFromFields(fields), isoTimeFields = refineTimeBag(fields), timeZoneSlot = refineTimeZoneArg(fields.timeZone);
    return {
      epochNanoseconds: getMatchingInstantFor(getTimeZoneOps(timeZoneSlot), {
        ...isoDateFields,
        ...isoTimeFields
      }, void 0 !== fields.offset ? parseOffsetNano(fields.offset) : void 0),
      timeZone: timeZoneSlot
    };
  }
  return {
    ...calendarOps.dateFromFields(fields),
    ...isoTimeFieldDefaults
  };
}, exports.refineOverflowOptions = refineOverflowOptions, exports.refinePlainDateBag = (calendarOps, bag, options, requireFields = []) => {
  const fields = refineCalendarFields(calendarOps, bag, dateFieldNamesAlpha, requireFields);
  return calendarOps.dateFromFields(fields, options);
}, exports.refinePlainDateTimeBag = (calendarOps, bag, options) => {
  const fields = refineCalendarFields(calendarOps, bag, dateFieldNamesAlpha, [], timeFieldNamesAsc), overflow = refineOverflowOptions(options);
  return createPlainDateTimeSlots(checkIsoDateTimeInBounds({
    ...calendarOps.dateFromFields(fields, overrideOverflowOptions(options, overflow)),
    ...refineTimeBag(fields, overflow)
  }));
}, exports.refinePlainMonthDayBag = (calendarOps, calendarAbsent, bag, options, requireFields = []) => {
  const fields = refineCalendarFields(calendarOps, bag, dateFieldNamesAlpha, requireFields);
  return calendarAbsent && void 0 !== fields.month && void 0 === fields.monthCode && void 0 === fields.year && (fields.year = isoEpochFirstLeapYear), 
  calendarOps.monthDayFromFields(fields, options);
}, exports.refinePlainTimeBag = (bag, options) => {
  const overflow = refineOverflowOptions(options);
  return createPlainTimeSlots(refineTimeBag(refineFields(bag, timeFieldNamesAlpha, [], 1), overflow));
}, exports.refinePlainYearMonthBag = (calendarOps, bag, options, requireFields) => {
  const fields = refineCalendarFields(calendarOps, bag, yearMonthFieldNames, requireFields);
  return calendarOps.yearMonthFromFields(fields, options);
}, exports.refineTimeZoneId = id => resolveTimeZoneId(requireString(id)), exports.refineZonedDateTimeBag = (refineTimeZoneArg, getTimeZoneOps, calendarOps, calendarSlot, bag, options) => {
  const fields = refineCalendarFields(calendarOps, bag, dateFieldNamesAlpha, timeZoneFieldNames, timeAndZoneFieldNames), timeZoneSlot = refineTimeZoneArg(fields.timeZone), [overflow, offsetDisambig, epochDisambig] = refineZonedFieldOptions(options), isoDateFields = calendarOps.dateFromFields(fields, overrideOverflowOptions(options, overflow)), isoTimeFields = refineTimeBag(fields, overflow);
  return createZonedDateTimeSlots(getMatchingInstantFor(getTimeZoneOps(timeZoneSlot), {
    ...isoDateFields,
    ...isoTimeFields
  }, void 0 !== fields.offset ? parseOffsetNano(fields.offset) : void 0, offsetDisambig, epochDisambig), timeZoneSlot, calendarSlot);
}, exports.refineZonedFieldOptions = refineZonedFieldOptions, exports.requireBoolean = requireBoolean, 
exports.requireFunction = requireFunction, exports.requireInteger = requireInteger, 
exports.requireIntegerOrUndefined = input => {
  if (void 0 !== input) {
    return requireInteger(input);
  }
}, exports.requireNonNullish = o => {
  if (null == o) {
    throw new TypeError("Cannot be null or undefined");
  }
  return o;
}, exports.requireObjectLike = requireObjectLike, exports.requirePositiveInteger = requirePositiveInteger, 
exports.requirePositiveIntegerOrUndefined = input => {
  if (void 0 !== input) {
    return requirePositiveInteger(input);
  }
}, exports.requireString = requireString, exports.requireStringOrUndefined = input => {
  if (void 0 !== input) {
    return requireString(input);
  }
}, exports.resolveCalendarId = resolveCalendarId, exports.resolveTimeZoneId = resolveTimeZoneId, 
exports.roundDuration = (refineRelativeTo, getCalendarOps, getTimeZoneOps, slots, options) => {
  const durationLargestUnit = getMaxDurationUnit(slots), [largestUnit, smallestUnit, roundingInc, roundingMode, relativeToSlots] = ((options, defaultLargestUnit, refineRelativeTo) => {
    options = normalizeOptionsOrString(options, smallestUnitStr);
    let largestUnit = refineLargestUnit(options);
    const relativeToInternals = refineRelativeTo(options.relativeTo);
    let roundingInc = parseRoundingIncInteger(options);
    const roundingMode = refineRoundingMode(options, 7);
    let smallestUnit = refineSmallestUnit(options);
    if (void 0 === largestUnit && void 0 === smallestUnit) {
      throw new RangeError("Required smallestUnit or largestUnit");
    }
    return null == smallestUnit && (smallestUnit = 0), null == largestUnit && (largestUnit = Math.max(smallestUnit, defaultLargestUnit)), 
    checkLargestSmallestUnit(largestUnit, smallestUnit), roundingInc = refineRoundingInc(roundingInc, smallestUnit, 1), 
    [ largestUnit, smallestUnit, roundingInc, roundingMode, relativeToInternals ];
  })(options, durationLargestUnit, refineRelativeTo), maxUnit = Math.max(durationLargestUnit, largestUnit);
  if (!isZonedEpochSlots(relativeToSlots) && maxUnit <= 6) {
    return createDurationSlots(checkDurationUnits(((durationFields, largestUnit, smallestUnit, roundingInc, roundingMode) => {
      const roundedBigNano = roundBigNano(durationFieldsToBigNano(durationFields), smallestUnit, roundingInc, roundingMode);
      return {
        ...durationFieldDefaults,
        ...nanoToDurationDayTimeFields(roundedBigNano, largestUnit)
      };
    })(slots, largestUnit, smallestUnit, roundingInc, roundingMode)));
  }
  if (!relativeToSlots) {
    throw new RangeError("Missing relativeTo");
  }
  const [marker, calendarOps, timeZoneOps] = createMarkerSystem(getCalendarOps, getTimeZoneOps, relativeToSlots), markerToEpochNano = createMarkerToEpochNano(timeZoneOps), moveMarker = createMoveMarker(timeZoneOps), diffMarkers = createDiffMarkers(timeZoneOps), endMarker = moveMarker(calendarOps, marker, slots);
  let balancedDuration = diffMarkers(calendarOps, marker, endMarker, largestUnit);
  const origSign = slots.sign, balancedSign = computeDurationSign(balancedDuration);
  if (origSign && balancedSign && origSign !== balancedSign) {
    throw new RangeError(invalidProtocolResults);
  }
  return balancedSign && (balancedDuration = roundRelativeDuration(balancedDuration, markerToEpochNano(endMarker), largestUnit, smallestUnit, roundingInc, roundingMode, calendarOps, marker, markerToEpochNano, moveMarker)), 
  createDurationSlots(balancedDuration);
}, exports.roundInstant = (instantSlots, options) => {
  const [smallestUnit, roundingInc, roundingMode] = refineRoundingOptions(options, 5, 1);
  return createInstantSlots(roundBigNano(instantSlots.epochNanoseconds, smallestUnit, roundingInc, roundingMode, 1));
}, exports.roundPlainDateTime = (slots, options) => createPlainDateTimeSlots(roundDateTime(slots, ...refineRoundingOptions(options)), slots.calendar), 
exports.roundPlainTime = (slots, options) => {
  const [a, b, c] = refineRoundingOptions(options, 5);
  var roundingMode;
  return createPlainTimeSlots((roundingMode = c, roundTimeToNano(slots, computeNanoInc(a, b), roundingMode)[0]));
}, exports.roundZonedDateTime = (getTimeZoneOps, slots, options) => {
  let {epochNanoseconds: epochNanoseconds, timeZone: timeZone, calendar: calendar} = slots;
  const [smallestUnit, roundingInc, roundingMode] = refineRoundingOptions(options);
  if (0 === smallestUnit && 1 === roundingInc) {
    return slots;
  }
  const timeZoneOps = getTimeZoneOps(timeZone);
  if (6 === smallestUnit) {
    epochNanoseconds = ((computeInterval, timeZoneOps, slots, roundingMode) => {
      const isoSlots = zonedEpochSlotsToIso(slots, timeZoneOps), [isoFields0, isoFields1] = computeInterval(isoSlots), epochNano = slots.epochNanoseconds, epochNano0 = getSingleInstantFor(timeZoneOps, isoFields0), epochNano1 = getSingleInstantFor(timeZoneOps, isoFields1);
      if (bigNanoOutside(epochNano, epochNano0, epochNano1)) {
        throw new RangeError(invalidProtocolResults);
      }
      return roundWithMode(computeEpochNanoFrac(epochNano, epochNano0, epochNano1), roundingMode) ? epochNano1 : epochNano0;
    })(computeDayInterval, timeZoneOps, slots, roundingMode);
  } else {
    const offsetNano = timeZoneOps.getOffsetNanosecondsFor(epochNanoseconds);
    epochNanoseconds = getMatchingInstantFor(timeZoneOps, roundDateTime(epochNanoToIso(epochNanoseconds, offsetNano), smallestUnit, roundingInc, roundingMode), offsetNano, 2, 0, 1);
  }
  return createZonedDateTimeSlots(epochNanoseconds, timeZone, calendar);
}, exports.slotsWithCalendar = (slots, calendarSlot) => ({
  ...slots,
  calendar: calendarSlot
}), exports.slotsWithTimeZone = (slots, timeZoneSlot) => ({
  ...slots,
  timeZone: timeZoneSlot
}), exports.timeConfig = timeConfig, exports.timeFieldNamesAsc = timeFieldNamesAsc, 
exports.totalDuration = (refineRelativeTo, getCalendarOps, getTimeZoneOps, slots, options) => {
  const maxDurationUnit = getMaxDurationUnit(slots), [totalUnit, relativeToSlots] = ((options, refineRelativeTo) => {
    const relativeToInternals = refineRelativeTo((options = normalizeOptionsOrString(options, "unit")).relativeTo);
    let totalUnit = refineTotalUnit(options);
    return totalUnit = requirePropDefined("unit", totalUnit), [ totalUnit, relativeToInternals ];
  })(options, refineRelativeTo);
  if (isUniformUnit(Math.max(totalUnit, maxDurationUnit), relativeToSlots)) {
    return totalDayTimeDuration(slots, totalUnit);
  }
  if (!relativeToSlots) {
    throw new RangeError("Missing relativeTo");
  }
  const [marker, calendarOps, timeZoneOps] = createMarkerSystem(getCalendarOps, getTimeZoneOps, relativeToSlots), markerToEpochNano = createMarkerToEpochNano(timeZoneOps), moveMarker = createMoveMarker(timeZoneOps), diffMarkers = createDiffMarkers(timeZoneOps), endMarker = moveMarker(calendarOps, marker, slots), balancedDuration = diffMarkers(calendarOps, marker, endMarker, totalUnit);
  return isUniformUnit(totalUnit, relativeToSlots) ? totalDayTimeDuration(balancedDuration, totalUnit) : ((durationFields, endEpochNano, totalUnit, calendarOps, marker, markerToEpochNano, moveMarker) => {
    const sign = computeDurationSign(durationFields), [epochNano0, epochNano1] = clampRelativeDuration(calendarOps, clearDurationFields(totalUnit, durationFields), totalUnit, sign, marker, markerToEpochNano, moveMarker), frac = computeEpochNanoFrac(endEpochNano, epochNano0, epochNano1);
    return durationFields[durationFieldNamesAsc[totalUnit]] + frac * sign;
  })(balancedDuration, markerToEpochNano(endMarker), totalUnit, calendarOps, marker, markerToEpochNano, moveMarker);
}, exports.unitNamesAsc = unitNamesAsc, exports.validateTimeZoneGap = validateTimeZoneGap, 
exports.validateTimeZoneOffset = validateTimeZoneOffset, exports.yearMonthConfig = yearMonthConfig, 
exports.zonedConfig = zonedConfig, exports.zonedDateTimeToInstant = zonedDateTimeSlots0 => createInstantSlots(zonedDateTimeSlots0.epochNanoseconds), 
exports.zonedDateTimeToPlainDate = (getTimeZoneOps, zonedDateTimeSlots0) => createPlainDateSlots(zonedEpochSlotsToIso(zonedDateTimeSlots0, getTimeZoneOps)), 
exports.zonedDateTimeToPlainDateTime = (getTimeZoneOps, zonedDateTimeSlots0) => createPlainDateTimeSlots(zonedEpochSlotsToIso(zonedDateTimeSlots0, getTimeZoneOps)), 
exports.zonedDateTimeToPlainMonthDay = (getCalendarOps, zonedDateTimeSlots0, zonedDateTimeFields) => convertToPlainMonthDay(getCalendarOps(zonedDateTimeSlots0.calendar), zonedDateTimeFields), 
exports.zonedDateTimeToPlainTime = (getTimeZoneOps, zonedDateTimeSlots0) => createPlainTimeSlots(zonedEpochSlotsToIso(zonedDateTimeSlots0, getTimeZoneOps)), 
exports.zonedDateTimeToPlainYearMonth = (getCalendarOps, zonedDateTimeSlots0, zonedDateTimeFields) => convertToPlainYearMonth(getCalendarOps(zonedDateTimeSlots0.calendar), zonedDateTimeFields), 
exports.zonedDateTimeWithFields = (getCalendarOps, getTimeZoneOps, zonedDateTimeSlots, initialFields, modFields, options) => {
  const optionsCopy = copyOptions(options), {calendar: calendar, timeZone: timeZone} = zonedDateTimeSlots;
  return createZonedDateTimeSlots(((calendarOps, timeZoneOps, initialFields, modFields, options) => {
    const fields = mergeCalendarFields(calendarOps, initialFields, modFields, dateFieldNamesAlpha, timeAndOffsetFieldNames, offsetFieldNames), [overflow, offsetDisambig, epochDisambig] = refineZonedFieldOptions(options, 2);
    return getMatchingInstantFor(timeZoneOps, {
      ...calendarOps.dateFromFields(fields, overrideOverflowOptions(options, overflow)),
      ...refineTimeBag(fields, overflow)
    }, parseOffsetNano(fields.offset), offsetDisambig, epochDisambig);
  })(getCalendarOps(calendar), getTimeZoneOps(timeZone), initialFields, modFields, optionsCopy), timeZone, calendar);
}, exports.zonedDateTimeWithPlainDate = (getTimeZoneOps, zonedDateTimeSlots, plainDateSlots) => {
  const timeZoneSlot = zonedDateTimeSlots.timeZone, timeZoneOps = getTimeZoneOps(timeZoneSlot), isoFields = {
    ...zonedEpochSlotsToIso(zonedDateTimeSlots, timeZoneOps),
    ...plainDateSlots
  }, calendar = getPreferredCalendarSlot(zonedDateTimeSlots.calendar, plainDateSlots.calendar);
  return createZonedDateTimeSlots(getMatchingInstantFor(timeZoneOps, isoFields, isoFields.offsetNanoseconds, 2), timeZoneSlot, calendar);
}, exports.zonedDateTimeWithPlainTime = (getTimeZoneOps, zonedDateTimeSlots, plainTimeSlots = isoTimeFieldDefaults) => {
  const timeZoneSlot = zonedDateTimeSlots.timeZone, timeZoneOps = getTimeZoneOps(timeZoneSlot), isoFields = {
    ...zonedEpochSlotsToIso(zonedDateTimeSlots, timeZoneOps),
    ...plainTimeSlots
  };
  return createZonedDateTimeSlots(getMatchingInstantFor(timeZoneOps, isoFields, isoFields.offsetNanoseconds, 2), timeZoneSlot, zonedDateTimeSlots.calendar);
}, exports.zonedDateTimesEqual = (zonedDateTimeSlots0, zonedDateTimeSlots1) => !compareZonedDateTimes(zonedDateTimeSlots0, zonedDateTimeSlots1) && !!isTimeZoneSlotsEqual(zonedDateTimeSlots0.timeZone, zonedDateTimeSlots1.timeZone) && isIdLikeEqual(zonedDateTimeSlots0.calendar, zonedDateTimeSlots1.calendar), 
exports.zonedEpochSlotsToIso = zonedEpochSlotsToIso;
