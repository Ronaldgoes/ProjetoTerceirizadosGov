export const CUSTEIO_DATA_SOURCE = {
  mode: "official_cache",
  official: {
    baseZipUrl: "https://arquivos.transparencia.sc.gov.br/transparenciasc/dados-abertos/despesa",
    yearStart: 2021,
    yearEnd: 2026,
    monthsByYear: {
      2021: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      2022: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      2023: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      2024: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      2025: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      2026: [1, 2],
    },
  },
  cache: {
    aggregatedJson: "/data/custeio-oficial.json",
  },
};
