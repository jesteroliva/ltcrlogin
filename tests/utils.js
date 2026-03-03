const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function timestamp() {
  const date = new Date();
  const parts = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');
  const dayPeriod = (get('dayPeriod') || '').toUpperCase();

  return `${year}-${month}-${day}_${hour}-${minute}-${second}_${dayPeriod}_PHT`;
}

function safeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function writeFileSafely(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

module.exports = {
  ensureDir,
  timestamp,
  safeName,
  csvEscape,
  writeFileSafely,
};
