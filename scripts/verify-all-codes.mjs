import fs from 'fs';
const data = JSON.parse(fs.readFileSync('./public/data/custeio-oficial.json', 'utf8'));

const targetName = "apoio administrativo";
const found = new Set();

data.subelementos.forEach(s => {
  if (s.name.toLowerCase().includes(targetName)) {
    found.add(s.code);
    console.log(`Encontrado: ${s.code} - ${s.name}`);
  }
});

const codes = Array.from(found);
const start = "2021-01";
const end = "2026-01";

let empenhado = 0;
let liquidado = 0;
let pago = 0;

data.facts.forEach(f => {
  const [year, month, el, sub, ug, vEmp, vLiq, vPag] = f;
  const periodKey = `${year}-${String(month).padStart(2, "0")}`;
  if (codes.includes(sub) && periodKey >= start && periodKey <= end) {
    empenhado += vEmp;
    liquidado += vLiq;
    pago += vPag;
  }
});

console.log(`\nTOTAIS PARA TODOS OS CÓDIGOS ENCONTRADOS (${start} até ${end}):`);
console.log(`Empenhado: ${empenhado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
console.log(`Liquidado: ${liquidado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
console.log(`Pago: ${pago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
