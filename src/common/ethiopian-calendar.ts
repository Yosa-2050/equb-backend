// Ethiopian (Ge'ez) calendar <-> Gregorian calendar conversion, via Julian Day
// Number. 13 months: 12 of 30 days + Pagume (5 days, 6 in an Ethiopian leap
// year). Ethiopian New Year (1 Meskerem) falls on Sept 11 Gregorian, or
// Sept 12 in the year before a Gregorian leap year.

const JD_EPOCH_OFFSET_AMETE_MIHRET = 1724220;

export interface EthiopianDate {
  year: number;
  month: number; // 1..13
  day: number; // 1..30 (1..5/6 for Pagume)
}

function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

// 1-indexed day count (from the Ethiopian epoch) of 1 Meskerem of `year`.
function ethiopianYearStart(year: number): number {
  return (year - 1) * 365 + Math.floor(year / 4) + 1;
}

function ethiopianToJdn(year: number, month: number, day: number): number {
  return (
    day +
    (month - 1) * 30 +
    (year - 1) * 365 +
    Math.floor(year / 4) +
    JD_EPOCH_OFFSET_AMETE_MIHRET
  );
}

function jdnToEthiopian(jdn: number): EthiopianDate {
  const x = jdn - JD_EPOCH_OFFSET_AMETE_MIHRET; // 1-indexed day count (x=1 => year1/month1/day1)
  let year = Math.floor((x - 1) / 365.25) + 1;
  while (ethiopianYearStart(year + 1) <= x) year++;
  while (ethiopianYearStart(year) > x) year--;
  const doy = x - ethiopianYearStart(year); // 0-indexed day within year
  const month = Math.floor(doy / 30) + 1;
  const day = (doy % 30) + 1;
  return { year, month, day };
}

export function gregorianToEthiopian(date: Date): EthiopianDate {
  const jdn = gregorianToJdn(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
  return jdnToEthiopian(jdn);
}

export function ethiopianToGregorian(
  year: number,
  month: number,
  day: number,
): Date {
  const jdn = ethiopianToJdn(year, month, day);
  const g = jdnToGregorian(jdn);
  return new Date(Date.UTC(g.year, g.month - 1, g.day));
}

export function isEthiopianLeapYear(year: number): boolean {
  return year % 4 === 3;
}

// Days in a given Ethiopian month (13 = Pagume: 5, or 6 in a leap year).
export function daysInEthiopianMonth(year: number, month: number): number {
  if (month === 13) return isEthiopianLeapYear(year) ? 6 : 5;
  return 30;
}

export const ETHIOPIAN_MONTH_NAMES = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yekatit',
  'Megabit',
  'Miazia',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehase',
  'Pagume',
];

export function formatEthiopianDate(date: Date): string {
  const e = gregorianToEthiopian(date);
  return `${e.day} ${ETHIOPIAN_MONTH_NAMES[e.month - 1]} ${e.year}`;
}
