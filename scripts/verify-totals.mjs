import fs from 'fs';
const data = JSON.parse(fs.readFileSync('./public/data/custeio-oficial.json', 'utf8'));

const subelemento = "33903701";
const start = "2021-01";
const end = "2026-01";

const totalsByMonth = {};

data.facts.forEach(f => {
  const [year, month, el, sub, ug, vEmp, vLiq, vPag] = f;
  if (sub === subelemento && year === 2026) {
    if (!totalsByMonth[month]) totalsByMonth[month] = { empenhado: 0, liquidado: 0, pago: 0 };
    totalsByMonth[month].empenhado += vEmp;
    totalsByMonth[month].liquidado += vLiq;
    totalsByMonth[month].pago += vPag;
  }
});

console.log(`TOTAIS MENSAIS DE 2026 PARA ${subelemento}:`);
Object.entries(totalsByMonth).forEach(([month, t]) => {
  console.log(`Mês ${month}:`);
  console.log(`  Empenhado: ${t.empenhado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
});
