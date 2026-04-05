import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const require = createRequire(import.meta.url);
const PptxGenJS = require("C:/Users/ronal/AppData/Roaming/npm/node_modules/pptxgenjs/dist/pptxgen.cjs.js");

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches

// ── PALETA ──────────────────────────────────────────────────────────────────
const C = {
  navy:     "060D1A",
  card:     "0D1F3C",
  border:   "1E3A5F",
  blue:     "0EA5E9",
  lightBlue:"38BDF8",
  green:    "10B981",
  text:     "CBD5E1",
  muted:    "94A3B8",
  white:    "F8FAFC",
  dark:     "031525",
};

// ── HELPERS ─────────────────────────────────────────────────────────────────
function addBg(slide) {
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: C.navy } });
}

function title(slide, text, y = 0.35) {
  slide.addText(text, {
    x: 0.5, y, w: 12.33, h: 0.7,
    fontSize: 28, bold: true, color: C.white, fontFace: "Calibri",
  });
}

function kicker(slide, text, y = 0.15) {
  slide.addText(text.toUpperCase(), {
    x: 0.5, y, w: 12.33, h: 0.28,
    fontSize: 9, bold: true, color: C.lightBlue, fontFace: "Calibri",
    charSpacing: 3,
  });
}

function card(slide, x, y, w, h, fillColor = C.card) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: fillColor },
    line: { color: C.border, width: 0.5 },
    rectRadius: 0.12,
  });
}

function accentLine(slide, x, y, w) {
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h: 0.04,
    fill: { type: "solid", color: C.blue },
    line: { type: "none" },
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — CAPA
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBg(s);

  // Gradiente de destaque no topo esquerdo (simulado com retângulo semitransparente)
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 7, h: 7.5,
    fill: { color: C.card },
    line: { type: "none" },
  });
  accentLine(s, 0, 0, 7);

  s.addText("PAINEL GOV", {
    x: 0.5, y: 0.9, w: 6, h: 0.35,
    fontSize: 9, bold: true, color: C.lightBlue, charSpacing: 5, fontFace: "Calibri",
  });

  s.addText("Gestão de Contratos\nTerceirizados", {
    x: 0.5, y: 1.35, w: 6, h: 2,
    fontSize: 38, bold: true, color: C.white, fontFace: "Calibri", lineSpacingMultiple: 1.1,
  });

  s.addText("Visão geral do sistema — Governo do Estado de Santa Catarina", {
    x: 0.5, y: 3.5, w: 6, h: 0.45,
    fontSize: 13, color: C.muted, fontFace: "Calibri",
  });

  // Stats à direita
  const stats = [
    { n: "3",     label: "Páginas principais" },
    { n: "9",     label: "Órgãos monitorados" },
    { n: "2021→", label: "Dados desde" },
    { n: "BI",    label: "Painel analítico" },
  ];
  stats.forEach(({ n, label }, i) => {
    const cx = 7.8 + (i % 2) * 2.6;
    const cy = 1.8 + Math.floor(i / 2) * 2;
    card(s, cx, cy, 2.2, 1.6);
    s.addText(n, { x: cx, y: cy + 0.2, w: 2.2, h: 0.7, fontSize: 30, bold: true, color: C.lightBlue, align: "center", fontFace: "Calibri" });
    s.addText(label, { x: cx, y: cy + 0.9, w: 2.2, h: 0.45, fontSize: 11, color: C.muted, align: "center", fontFace: "Calibri" });
  });

  s.addText("React 19  •  Vite  •  React Router v7  •  Dados oficiais SC", {
    x: 0.5, y: 6.8, w: 12.33, h: 0.35,
    fontSize: 9, color: C.border, align: "center", fontFace: "Calibri",
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 2 — ESTRUTURA DE NAVEGAÇÃO
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBg(s);
  kicker(s, "Arquitetura de rotas");
  title(s, "Como o site é organizado", 0.45);
  accentLine(s, 0.5, 1.22, 2.2);

  const rotas = [
    {
      rota: "/",
      nome: "Home",
      desc: "Ponto de entrada. Cards de órgãos, atalhos para Contratos e Painel BI.",
      cor: C.blue,
    },
    {
      rota: "/gestao/:orgaoId/*",
      nome: "Contratos",
      desc: "Dashboard operacional por órgão. Lê planilhas .xlsx com contratos, termos aditivos e apostilamentos.",
      cor: C.green,
    },
    {
      rota: "/analise-custeio",
      nome: "Painel BI",
      desc: "Análise de despesas de custeio. Dados oficiais do Portal da Transparência SC.",
      cor: "F59E0B",
    },
  ];

  rotas.forEach(({ rota, nome, desc, cor }, i) => {
    const y = 1.45 + i * 1.85;
    card(s, 0.5, y, 12.33, 1.6);
    // barra colorida lateral
    s.addShape(pptx.ShapeType.rect, { x: 0.5, y, w: 0.06, h: 1.6, fill: { color: cor }, line: { type: "none" } });
    s.addText(rota, { x: 0.75, y: y + 0.12, w: 4, h: 0.35, fontSize: 10, color: cor, bold: true, fontFace: "Calibri", charSpacing: 1 });
    s.addText(nome, { x: 0.75, y: y + 0.45, w: 4, h: 0.45, fontSize: 20, bold: true, color: C.white, fontFace: "Calibri" });
    s.addText(desc, { x: 4.9, y: y + 0.3, w: 7.6, h: 0.9, fontSize: 12, color: C.muted, fontFace: "Calibri", valign: "middle" });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 3 — HOME (OrgansHomePage)
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBg(s);
  kicker(s, "Página 1 de 3");
  title(s, "Home — Entrada Principal", 0.45);
  accentLine(s, 0.5, 1.22, 2.2);

  const itens = [
    { icon: "🏷️", t: "Badge + Marca",     d: "Identidade do sistema no topo esquerdo com toggle de tema (sol/lua)." },
    { icon: "⚡", t: "Atalhos Rápidos",    d: "2 cards: Contratos e Painel BI, para entrar sem navegar a tela toda." },
    { icon: "🏛️", t: "4 Órgãos em Destaque", d: "Cards dos 4 primeiros órgãos para acesso direto aos contratos." },
    { icon: "📋", t: "Grade Completa",     d: "Todos os 9 órgãos listados com link direto para seus contratos." },
    { icon: "🧩", t: "Feature Strip",      d: "3 cards explicando o fluxo do sistema de forma resumida." },
  ];

  itens.forEach(({ icon, t, d }, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 6.5;
    const y = 1.45 + row * 1.85;
    const w = i === 4 ? 12.33 : 6;
    card(s, x, y, w, 1.6);
    s.addText(icon, { x: x + 0.2, y: y + 0.15, w: 0.8, h: 0.8, fontSize: 24, align: "center" });
    s.addText(t, { x: x + 1.05, y: y + 0.15, w: w - 1.25, h: 0.4, fontSize: 14, bold: true, color: C.white, fontFace: "Calibri" });
    s.addText(d, { x: x + 1.05, y: y + 0.55, w: w - 1.25, h: 0.75, fontSize: 11, color: C.muted, fontFace: "Calibri" });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — CONTRATOS (ContractsDashboardPage)
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBg(s);
  kicker(s, "Página 2 de 3");
  title(s, "Gestão de Contratos por Órgão", 0.45);
  accentLine(s, 0.5, 1.22, 2.6);

  // Coluna esquerda: fluxo
  card(s, 0.5, 1.4, 5.8, 5.6);
  s.addText("Fluxo de uso", { x: 0.7, y: 1.55, w: 5.4, h: 0.4, fontSize: 13, bold: true, color: C.lightBlue, fontFace: "Calibri" });

  const steps = [
    "1.  Acesse /gestao/{orgaoId}/contratos",
    "2.  Planilha .xlsx é carregada automaticamente",
    "3.  Contratos são agrupados por número/objeto",
    "4.  Clique num contrato para ver seus documentos",
    "5.  Termos aditivos e apostilamentos ficam vinculados",
    "6.  Busca filtra por contrato ou documento",
  ];
  steps.forEach((step, i) => {
    s.addText(step, {
      x: 0.75, y: 2.1 + i * 0.75, w: 5.3, h: 0.55,
      fontSize: 11, color: i % 2 === 0 ? C.text : C.muted, fontFace: "Calibri",
    });
  });

  // Coluna direita: recursos
  const recursos = [
    { icon: "☰", t: "Menu Hambúrguer",  d: "Troca de órgão sem sair da página" },
    { icon: "🔍", t: "Busca Inteligente", d: "Filtra contratos e documentos" },
    { icon: "📁", t: "9 Órgãos",         d: "DETRAN, SEF, SAS, SEJURI..." },
    { icon: "🌗", t: "Tema claro/escuro", d: "Toggle no header" },
  ];
  recursos.forEach(({ icon, t, d }, i) => {
    const y = 1.4 + i * 1.42;
    card(s, 6.6, y, 6.23, 1.2);
    s.addText(icon, { x: 6.8, y: y + 0.1, w: 0.7, h: 0.7, fontSize: 22, align: "center" });
    s.addText(t, { x: 7.6, y: y + 0.1, w: 5, h: 0.38, fontSize: 13, bold: true, color: C.white, fontFace: "Calibri" });
    s.addText(d, { x: 7.6, y: y + 0.5, w: 5, h: 0.5, fontSize: 11, color: C.muted, fontFace: "Calibri" });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — PAINEL BI (CusteioDashboard)
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBg(s);
  kicker(s, "Página 3 de 3");
  title(s, "Painel BI — Análise de Custeio", 0.45);
  accentLine(s, 0.5, 1.22, 2.6);

  const abas = [
    { n: "Visão Geral",  d: "Série anual + ranking UGs + elementos" },
    { n: "Mensal",       d: "Barras mensais + variação período a período" },
    { n: "Distribuição", d: "Gráficos de pizza por subelemento e UG" },
    { n: "Evolução",     d: "Listas mensais e série histórica" },
    { n: "Matriz",       d: "Tabela cruzada subelemento × ano" },
    { n: "Ranking UG",   d: "Linhas evolutivas das 10 maiores UGs" },
    { n: "Alertas",      d: "Variações acima do limite configurável" },
    { n: "Dicas",        d: "Insights automáticos do período filtrado" },
  ];

  abas.forEach(({ n, d }, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.5 + col * 3.22;
    const y = 1.42 + row * 2.2;
    card(s, x, y, 2.95, 1.9);
    s.addShape(pptx.ShapeType.rect, { x, y, w: 2.95, h: 0.06, fill: { color: C.blue }, line: { type: "none" } });
    s.addText(n, { x, y: y + 0.15, w: 2.95, h: 0.45, fontSize: 13, bold: true, color: C.white, align: "center", fontFace: "Calibri" });
    s.addText(d, { x, y: y + 0.65, w: 2.95, h: 0.95, fontSize: 10, color: C.muted, align: "center", fontFace: "Calibri" });
  });

  // métricas
  const metricas = ["Empenhado", "Liquidado", "Pago"];
  metricas.forEach((m, i) => {
    const x = 0.5 + i * 4.1;
    s.addText(`💰 ${m}`, { x, y: 5.9, w: 3.8, h: 0.45, fontSize: 12, color: C.green, bold: true, align: "center", fontFace: "Calibri" });
  });
  s.addText("3 métricas selecionáveis  •  Filtros por ano, período, elemento, subelemento e unidade gestora", {
    x: 0.5, y: 6.4, w: 12.33, h: 0.4,
    fontSize: 10, color: C.muted, align: "center", fontFace: "Calibri",
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 6 — DADOS: COMO FUNCIONAM
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBg(s);
  kicker(s, "Arquitetura de dados");
  title(s, "De onde vêm os dados", 0.45);
  accentLine(s, 0.5, 1.22, 2);

  // Fluxo BI
  card(s, 0.5, 1.4, 12.33, 2.3);
  s.addText("PAINEL BI — Fonte oficial Portal da Transparência SC", {
    x: 0.7, y: 1.52, w: 11.9, h: 0.38, fontSize: 11, bold: true, color: C.lightBlue, fontFace: "Calibri",
  });

  const etapasBI = [
    { t: "Portal SC", d: "ZIPs mensais\n(despesa + restos)" },
    { t: "Script Node", d: "npm run sync:custeio\nDownload + parse CSV" },
    { t: "JSON Cache", d: "custeio-oficial.json\nstar schema compacto" },
    { t: "Dashboard", d: "fetch() estático\nnenhum backend" },
  ];
  etapasBI.forEach(({ t, d }, i) => {
    const x = 0.7 + i * 3.08;
    const y = 2.05;
    card(s, x, y, 2.7, 1.3, "060D1A");
    s.addText(t, { x, y: y + 0.08, w: 2.7, h: 0.35, fontSize: 12, bold: true, color: C.white, align: "center", fontFace: "Calibri" });
    s.addText(d, { x, y: y + 0.45, w: 2.7, h: 0.75, fontSize: 10, color: C.muted, align: "center", fontFace: "Calibri" });
    if (i < 3) {
      s.addText("→", { x: x + 2.7, y: y + 0.42, w: 0.38, h: 0.45, fontSize: 18, color: C.blue, align: "center" });
    }
  });

  // Fluxo Contratos
  card(s, 0.5, 3.95, 12.33, 2.3);
  s.addText("CONTRATOS — Planilhas .xlsx por órgão", {
    x: 0.7, y: 4.07, w: 11.9, h: 0.38, fontSize: 11, bold: true, color: C.green, fontFace: "Calibri",
  });

  const etapasXLS = [
    { t: "Planilhas", d: "public/planilhas/\ndetran.xlsx, sef.xlsx..." },
    { t: "workbookImport", d: "Leitura com lib xlsx\nno navegador" },
    { t: "contractGroups", d: "Agrupa por contrato\nprincipal" },
    { t: "Dashboard", d: "Cards e tabela\nde documentos" },
  ];
  etapasXLS.forEach(({ t, d }, i) => {
    const x = 0.7 + i * 3.08;
    const y = 4.6;
    card(s, x, y, 2.7, 1.3, "060D1A");
    s.addText(t, { x, y: y + 0.08, w: 2.7, h: 0.35, fontSize: 12, bold: true, color: C.white, align: "center", fontFace: "Calibri" });
    s.addText(d, { x, y: y + 0.45, w: 2.7, h: 0.75, fontSize: 10, color: C.muted, align: "center", fontFace: "Calibri" });
    if (i < 3) {
      s.addText("→", { x: x + 2.7, y: y + 0.42, w: 0.38, h: 0.45, fontSize: 18, color: C.green, align: "center" });
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 7 — TEMA CLARO/ESCURO
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBg(s);
  kicker(s, "UX / Interface");
  title(s, "Toggle de Tema — Claro e Escuro", 0.45);
  accentLine(s, 0.5, 1.22, 2.4);

  // Modo escuro
  card(s, 0.5, 1.45, 5.9, 5.5);
  s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.45, w: 5.9, h: 0.06, fill: { color: "1E3A5F" }, line: { type: "none" } });
  s.addText("🌙  Modo Escuro (padrão)", { x: 0.7, y: 1.6, w: 5.5, h: 0.45, fontSize: 14, bold: true, color: C.lightBlue, fontFace: "Calibri" });
  const darkItems = [
    "Fundo: #060D1A (navy profundo)",
    "Cards: #0D1F3C",
    "Texto: #CBD5E1",
    "Acento: #0EA5E9 (azul)",
    "Ideal para uso prolongado e apresentações",
  ];
  darkItems.forEach((item, i) => {
    s.addText(`• ${item}`, { x: 0.75, y: 2.25 + i * 0.72, w: 5.4, h: 0.55, fontSize: 12, color: C.text, fontFace: "Calibri" });
  });

  // Modo claro
  card(s, 6.7, 1.45, 5.9, 5.5, "F1F5F9");
  s.addShape(pptx.ShapeType.rect, { x: 6.7, y: 1.45, w: 5.9, h: 0.06, fill: { color: "CBD5E1" }, line: { type: "none" } });
  s.addText("☀️  Modo Claro", { x: 6.9, y: 1.6, w: 5.5, h: 0.45, fontSize: 14, bold: true, color: "0284C7", fontFace: "Calibri" });
  const lightItems = [
    "Fundo: #F1F5F9 (cinza claro)",
    "Cards: #FFFFFF",
    "Texto: #1E293B",
    "Acento: #0284C7 (azul mais escuro)",
    "Preferência salva no localStorage",
  ];
  lightItems.forEach((item, i) => {
    s.addText(`• ${item}`, { x: 6.9, y: 2.25 + i * 0.72, w: 5.5, h: 0.55, fontSize: 12, color: "475569", fontFace: "Calibri" });
  });

  s.addText("O ícone aparece em todas as páginas: Home (esquerda + direita), Contratos (header), BI (topbar)", {
    x: 0.5, y: 7.1, w: 12.33, h: 0.35,
    fontSize: 9.5, color: C.muted, align: "center", fontFace: "Calibri",
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SALVAR
// ════════════════════════════════════════════════════════════════════════════
const outPath = "C:/Users/ronal/OneDrive/Desktop/ProjetoTerceirizadosGov/Apresentacao-PainelGov.pptx";
await pptx.writeFile({ fileName: outPath });
console.log("Apresentacao gerada:", outPath);
