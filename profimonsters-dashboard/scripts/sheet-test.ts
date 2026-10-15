import assert from 'node:assert/strict';
import { toCsvUrl } from '../src/server/connectors/googleSheets';
import { buildPreview, rowsFromCsvText } from '../src/data/import/importer';

assert.equal(toCsvUrl('https://docs.google.com/spreadsheets/d/AbC-123_x/edit#gid=456'), 'https://docs.google.com/spreadsheets/d/AbC-123_x/export?format=csv&gid=456');
assert.equal(toCsvUrl('https://docs.google.com/spreadsheets/d/AbC/edit?usp=sharing'), 'https://docs.google.com/spreadsheets/d/AbC/export?format=csv&gid=0');
const pub = 'https://docs.google.com/spreadsheets/d/e/2PACX-1v/pub?gid=0&single=true&output=csv';
assert.equal(toCsvUrl(pub), pub);
assert.throws(() => toCsvUrl('https://example.com/x.csv'));

// Как Google отдаёт CSV при русской локали
const csv = '﻿Дата,Проект,Показатель,Значение,План,Примечание\r\n01.10.2026,Альфа,Количество лидов,"1 234",150,\r\n01.10.2026,Альфа,Конверсия из лида в оформленного и назначенного на стаж,"34,5%",,\r\n02.10.2026,Альфа,Выручка Тотал,"1 250 000,00 ₽",,"клиент, сократил"\r\n';
const p = buildPreview(rowsFromCsvText(csv), 'csv', new Set(), 'google-sheets');
assert.equal(p.issues.length, 0, JSON.stringify(p.issues));
assert.deepEqual(p.records.map((r) => r.value), [1234, 34.5, 1250000]);
assert.equal(p.records[2].note, 'клиент, сократил');
assert.equal(p.records[0].source, 'google-sheets');
console.log('sheet ok');
