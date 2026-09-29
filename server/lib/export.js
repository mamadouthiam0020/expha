'use strict';

const Registration = require('../models/Registration');
const { buildFilter, buildSort } = require('./registrationsService');
const { EVENT } = require('../config/event');

const COLUMNS = [
  { key: 'numeroInscription', header: 'N° inscription' },
  { key: 'createdAt', header: "Date d'inscription" },
  { key: 'nom', header: 'Nom' },
  { key: 'prenom', header: 'Prénom' },
  { key: 'telephone', header: 'Téléphone' },
  { key: 'structureMedicale', header: 'Structure médicale' },
  { key: 'invitePar', header: 'Invité(e) par' },
  { key: 'pointRamassage', header: 'Point de ramassage' },
];

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[";\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function telForExcel(telephone) {
  // Evite linterpretation en formule / format scientifique dans Excel
  const raw = String(telephone || '').replace(/[^\d+]/g, '');
  if (!raw) return '';
  return raw.startsWith('+') ? `'${raw}` : raw;
}

function buildRows(items) {
  return items.map((item) =>
    COLUMNS.map((col) => {
      switch (col.key) {
        case 'createdAt':
          return formatDate(item.createdAt);
        case 'telephone':
          return telForExcel(item.telephone);
        default:
          return item[col.key];
      }
    })
  );
}

function timestampName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** CSV avec BOM UTF-8 : s'ouvre correctement dans Excel FR. */
function toCsv(items) {
  const header = COLUMNS.map((c) => escapeCsv(c.header)).join(';');
  const lines = buildRows(items).map((row) => row.map(escapeCsv).join(';'));
  return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;
}

/** Fichier "Excel" (.xls) : table HTML lue nativement par Excel / LibreOffice. */
function toExcelHtml(items) {
  const header = COLUMNS.map((c) => `<th style="background:#0f766e;color:#fff;padding:6px;">${c.header}</th>`).join('');
  const body = buildRows(items)
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => {
            const value = cell === null || cell === undefined ? '' : escapeHtml(String(cell));
            const style = cell && String(cell).startsWith('+') ? 'mso-number-format:"\\@";' : '';
            return `<td style="${style}padding:4px;border:1px solid #ddd;">${value}</td>`;
          })
          .join('')}</tr>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html xmlns:x="urn:schemas-microsoft-com:office:excel" lang="fr">
<head><meta charset="utf-8" /><title>Inscrits EXPHA</title></head>
<body>
<table>
<caption>${escapeHtml(EVENT.title)} – ${escapeHtml(EVENT.dateLabel)} – Inscrits : ${items.length}</caption>
<thead><tr>${header}</tr></thead>
<tbody>${body}</tbody>
</table>
</body>
</html>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Recupere toutes les inscriptions correspondant au filtre courant. */
async function fetchForExport(query) {
  return Registration.find(buildFilter(query)).sort(buildSort(query)).limit(20000).lean();
}

module.exports = { toCsv, toExcelHtml, fetchForExport, timestampName, COLUMNS, formatDate };
