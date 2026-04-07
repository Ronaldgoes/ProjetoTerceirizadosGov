export function buildMatrixRows(records, groupKey, metricKey, years, limit, normalizeSearch, search, selectedCodes = null, codeKey = "") {
  const grouped = new Map();

  records.forEach((record) => {
    if (selectedCodes && !selectedCodes.includes(record[codeKey])) {
      return;
    }

    const key = record[groupKey] || "Não informado";
    const item = grouped.get(key) || { label: key, total: 0, byYear: {} };

    item.byYear[record.year] = (item.byYear[record.year] || 0) + record[metricKey];
    item.total += record[metricKey];
    grouped.set(key, item);
  });

  return [...grouped.values()]
    .filter((item) => normalizeSearch(item.label).includes(normalizeSearch(search)))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      yearValues: years.map((year) => item.byYear[year] || 0),
    }));
}
