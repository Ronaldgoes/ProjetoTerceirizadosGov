import fs from "fs";

const outPath = "C:/Users/ronal/OneDrive/Desktop/ProjetoTerceirizadosGov/Apresentacao-PainelGov.html";

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Painel Gov SC — Gestão de Contratos Terceirizados</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --navy:    #05101F;
  --navy2:   #0A1E38;
  --navy3:   #0F2A4A;
  --blue:    #1A6FBF;
  --blue2:   #2589E8;
  --gold:    #C8972A;
  --gold2:   #E8B84B;
  --white:   #FFFFFF;
  --off:     #F0F4F8;
  --text:    #C8D8E8;
  --muted:   #7A9BB8;
  --border:  rgba(255,255,255,0.08);
  --green:   #1A8C6F;
  --green2:  #22B98F;
}

body {
  font-family: 'Inter', sans-serif;
  background: #030C18;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ── SLIDE BASE ─────────────────────────────────────────── */
.slide {
  width: 297mm;
  height: 167mm;
  background: var(--navy);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  page-break-after: always;
  break-after: page;
}

/* Linha dourada no topo de todos os slides */
.slide::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--gold), var(--gold2), transparent 80%);
  z-index: 10;
}

/* Número do slide */
.slide-num {
  position: absolute;
  bottom: 12px;
  right: 24px;
  font-size: 9px;
  color: var(--muted);
  letter-spacing: 2px;
  font-weight: 500;
}

/* Brasão/logo area */
.slide-brand {
  position: absolute;
  top: 18px;
  right: 28px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.slide-brand span {
  font-size: 8px;
  color: var(--muted);
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
}

/* ════════════════════════════════════════════════
   SLIDE 1 — CAPA
════════════════════════════════════════════════ */
.s1 {
  background:
    radial-gradient(ellipse at 70% 50%, rgba(26,111,191,0.18) 0%, transparent 60%),
    radial-gradient(ellipse at 20% 80%, rgba(200,151,42,0.10) 0%, transparent 50%),
    linear-gradient(160deg, #05101F 0%, #07182E 50%, #05101F 100%);
  justify-content: center;
}

.s1-accent {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 6px;
  background: linear-gradient(180deg, var(--gold) 0%, var(--blue2) 100%);
}

.s1-content {
  padding: 0 72px;
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 0;
  align-items: center;
  height: 100%;
}

.s1-left { display: flex; flex-direction: column; gap: 0; }

.s1-pretitle {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: var(--gold2);
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.s1-pretitle::before {
  content: '';
  display: block;
  width: 28px;
  height: 1px;
  background: var(--gold2);
}

.s1-title {
  font-size: 38px;
  font-weight: 900;
  color: var(--white);
  line-height: 1.08;
  letter-spacing: -0.5px;
  margin-bottom: 20px;
}

.s1-title em {
  font-style: normal;
  color: var(--blue2);
}

.s1-sub {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.7;
  max-width: 400px;
  margin-bottom: 32px;
}

.s1-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.s1-tag {
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid rgba(200,151,42,0.35);
  background: rgba(200,151,42,0.08);
  color: var(--gold2);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

.s1-right {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding-left: 48px;
  border-left: 1px solid var(--border);
}

.kpi-box {
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 22px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.kpi-box:first-child { border-top: 2px solid var(--gold2); }
.kpi-box:nth-child(2) { border-top: 2px solid var(--blue2); }
.kpi-box:nth-child(3) { border-top: 2px solid var(--green2); }
.kpi-box:nth-child(4) { border-top: 2px solid var(--muted); }

.kpi-n {
  font-size: 30px;
  font-weight: 900;
  color: var(--white);
  line-height: 1;
}
.kpi-l {
  font-size: 10px;
  color: var(--muted);
  font-weight: 500;
  line-height: 1.4;
}


/* ════════════════════════════════════════════════
   SLIDE 2 — VISÃO EXECUTIVA
════════════════════════════════════════════════ */
.s2 {
  background: linear-gradient(135deg, #05101F 0%, #071828 100%);
  padding: 44px 60px 36px;
  gap: 28px;
}

.slide-header { display: flex; flex-direction: column; gap: 6px; }

.slide-kicker {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: var(--gold2);
  display: flex;
  align-items: center;
  gap: 10px;
}
.slide-kicker::before {
  content: '';
  display: block;
  width: 24px;
  height: 1px;
  background: var(--gold2);
}

.slide-title {
  font-size: 26px;
  font-weight: 800;
  color: var(--white);
  letter-spacing: -0.3px;
}

.exec-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  flex: 1;
}

.exec-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  overflow: hidden;
}

.exec-card::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 2px;
  background: var(--blue2);
}

.exec-card.gold::after { background: var(--gold2); }
.exec-card.green::after { background: var(--green2); }

.exec-icon {
  font-size: 28px;
  line-height: 1;
}

.exec-card h3 {
  font-size: 14px;
  font-weight: 700;
  color: var(--white);
}

.exec-card p {
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.65;
  flex: 1;
}

.exec-card .stat {
  font-size: 22px;
  font-weight: 800;
  color: var(--blue2);
}
.exec-card.gold .stat { color: var(--gold2); }
.exec-card.green .stat { color: var(--green2); }


/* ════════════════════════════════════════════════
   SLIDE 3 — ESTRUTURA DO SISTEMA
════════════════════════════════════════════════ */
.s3 {
  background: linear-gradient(160deg, #05101F 0%, #071828 100%);
  padding: 44px 60px 36px;
  gap: 24px;
}

.arch-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  flex: 1;
}

.arch-card {
  border-radius: 18px;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
  overflow: hidden;
}

.arch-card.blue {
  background: linear-gradient(145deg, rgba(37,137,232,0.18), rgba(37,137,232,0.05));
  border: 1px solid rgba(37,137,232,0.35);
}
.arch-card.gold {
  background: linear-gradient(145deg, rgba(200,151,42,0.18), rgba(200,151,42,0.05));
  border: 1px solid rgba(200,151,42,0.35);
}
.arch-card.green {
  background: linear-gradient(145deg, rgba(34,185,143,0.18), rgba(34,185,143,0.05));
  border: 1px solid rgba(34,185,143,0.35);
}

.arch-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  padding: 5px 12px;
  border-radius: 999px;
  width: fit-content;
}

.arch-card.blue  .arch-badge { background: rgba(37,137,232,0.2);  color: #60B4F8; }
.arch-card.gold  .arch-badge { background: rgba(200,151,42,0.2);  color: var(--gold2); }
.arch-card.green .arch-badge { background: rgba(34,185,143,0.2); color: var(--green2); }

.arch-card .route {
  font-size: 10px;
  font-family: 'Courier New', monospace;
  padding: 6px 12px;
  border-radius: 8px;
  background: rgba(0,0,0,0.3);
}
.arch-card.blue  .route { color: #60B4F8; }
.arch-card.gold  .route { color: var(--gold2); }
.arch-card.green .route { color: var(--green2); }

.arch-card h3 {
  font-size: 18px;
  font-weight: 800;
  color: var(--white);
}

.arch-card p {
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.65;
  flex: 1;
}

.arch-features {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.arch-feat {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10.5px;
  color: var(--text);
}

.arch-feat::before {
  content: '';
  width: 5px; height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}
.arch-card.blue  .arch-feat::before { background: var(--blue2); }
.arch-card.gold  .arch-feat::before { background: var(--gold2); }
.arch-card.green .arch-feat::before { background: var(--green2); }


/* ════════════════════════════════════════════════
   SLIDE 4 — PAINEL BI (destaque)
════════════════════════════════════════════════ */
.s4 {
  background:
    radial-gradient(ellipse at 90% 10%, rgba(37,137,232,0.15), transparent 50%),
    linear-gradient(160deg, #05101F, #071828);
  padding: 44px 60px 36px;
  gap: 24px;
}

.bi-abas {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.bi-aba {
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-top: 2px solid var(--blue2);
  border-radius: 12px;
  padding: 14px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.bi-aba strong {
  font-size: 11px;
  font-weight: 700;
  color: var(--white);
}

.bi-aba span {
  font-size: 9.5px;
  color: var(--muted);
  line-height: 1.5;
}

.bi-metricas {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.bi-metrica {
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.bi-metrica-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.bi-metrica strong { font-size: 13px; font-weight: 700; color: var(--white); }
.bi-metrica span   { font-size: 10px; color: var(--muted); display: block; margin-top: 3px; }

.bi-filtros {
  background: rgba(26,111,191,0.08);
  border: 1px solid rgba(37,137,232,0.25);
  border-radius: 12px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.bi-filtro-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--blue2);
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-right: 4px;
}

.bi-filtro-tag {
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(37,137,232,0.15);
  border: 1px solid rgba(37,137,232,0.3);
  color: #89C8F8;
  font-size: 9.5px;
  font-weight: 500;
}


/* ════════════════════════════════════════════════
   SLIDE 5 — CONTRATOS
════════════════════════════════════════════════ */
.s5 {
  background: linear-gradient(160deg, #05101F, #071828);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  padding: 0;
}

.s5-left {
  padding: 44px 44px 44px 60px;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.s5-right {
  padding: 44px 60px 44px 44px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  justify-content: center;
}

.flow-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.flow-step {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.03);
  border-radius: 12px;
  border: 1px solid var(--border);
}

.step-num {
  width: 26px; height: 26px;
  border-radius: 50%;
  background: var(--blue);
  color: var(--white);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.flow-step p {
  font-size: 11px;
  color: var(--text);
  line-height: 1.55;
  padding-top: 4px;
}

.feat-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: 14px;
}

.feat-icon {
  font-size: 22px;
  flex-shrink: 0;
  width: 40px;
  text-align: center;
}

.feat-item strong { font-size: 12px; font-weight: 700; color: var(--white); display: block; }
.feat-item span   { font-size: 10px; color: var(--muted); margin-top: 3px; display: block; }


/* ════════════════════════════════════════════════
   SLIDE 6 — DADOS
════════════════════════════════════════════════ */
.s6 {
  background: linear-gradient(160deg, #05101F, #071828);
  padding: 44px 60px 36px;
  gap: 22px;
}

.data-flow {
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 22px 26px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.data-flow-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 2.5px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 10px;
}

.data-flow-title span {
  display: block;
  width: 8px; height: 8px;
  border-radius: 50%;
}

.data-flow-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  align-items: center;
}

.data-node {
  background: rgba(0,0,0,0.3);
  border-radius: 12px;
  padding: 13px 14px;
  text-align: center;
}

.data-node strong { font-size: 11px; font-weight: 700; color: var(--white); display: block; }
.data-node span   { font-size: 9px;  color: var(--muted); margin-top: 4px; display: block; line-height: 1.5; }

.data-arrow { text-align: center; font-size: 16px; }


/* ════════════════════════════════════════════════
   SLIDE 7 — ENCERRAMENTO
════════════════════════════════════════════════ */
.s7 {
  background:
    radial-gradient(ellipse at 30% 50%, rgba(200,151,42,0.12), transparent 50%),
    radial-gradient(ellipse at 80% 30%, rgba(26,111,191,0.14), transparent 50%),
    linear-gradient(160deg, #05101F, #07182E);
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 0;
}

.s7-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  max-width: 640px;
}

.s7-badge {
  padding: 8px 20px;
  border-radius: 999px;
  border: 1px solid rgba(200,151,42,0.4);
  background: rgba(200,151,42,0.08);
  color: var(--gold2);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
}

.s7-title {
  font-size: 36px;
  font-weight: 900;
  color: var(--white);
  line-height: 1.1;
  letter-spacing: -0.5px;
}

.s7-title em { font-style: normal; color: var(--blue2); }

.s7-sub {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.75;
  max-width: 480px;
}

.s7-divider {
  width: 60px;
  height: 2px;
  background: linear-gradient(90deg, var(--gold), var(--blue2));
  border-radius: 999px;
}

.s7-info {
  display: flex;
  gap: 32px;
  align-items: center;
}

.s7-info-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.s7-info-item strong { font-size: 18px; font-weight: 800; color: var(--white); }
.s7-info-item span   { font-size: 9px;  color: var(--muted); letter-spacing: 1px; text-transform: uppercase; }

.s7-sep { color: var(--border); font-size: 20px; }

@media print {
  body { background: #000; margin: 0; }
  .slide { page-break-after: always; break-after: page; }
}
</style>
</head>
<body>

<!-- ══════════════════════════════════════════════
     SLIDE 1 — CAPA
══════════════════════════════════════════════ -->
<div class="slide s1">
  <div class="s1-accent"></div>
  <div class="slide-brand"><span>Governo do Estado de Santa Catarina</span></div>

  <div class="s1-content">
    <div class="s1-left">
      <div class="s1-pretitle">Sistema de Gestão Governamental</div>
      <h1 class="s1-title">Painel de <em>Contratos</em><br>Terceirizados</h1>
      <p class="s1-sub">Plataforma digital para monitoramento, análise e gestão dos contratos de serviços terceirizados do Poder Executivo do Estado de Santa Catarina.</p>
      <div class="s1-tags">
        <span class="s1-tag">Transparência</span>
        <span class="s1-tag">Dados Oficiais</span>
        <span class="s1-tag">Tempo Real</span>
        <span class="s1-tag">Portal SC</span>
      </div>
    </div>

    <div class="s1-right">
      <div class="kpi-box">
        <div class="kpi-n">9</div>
        <div class="kpi-l">Órgãos<br>monitorados</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-n">2021</div>
        <div class="kpi-l">Série histórica<br>desde</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-n">3</div>
        <div class="kpi-l">Métricas<br>financeiras</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-n">BI</div>
        <div class="kpi-l">Painel analítico<br>integrado</div>
      </div>
    </div>
  </div>
  <div class="slide-num">01 / 07</div>
</div>


<!-- ══════════════════════════════════════════════
     SLIDE 2 — VISÃO EXECUTIVA
══════════════════════════════════════════════ -->
<div class="slide s2">
  <div class="slide-brand"><span>Governo do Estado de Santa Catarina</span></div>

  <div class="slide-header">
    <div class="slide-kicker">Visão Executiva</div>
    <div class="slide-title">O que o sistema entrega</div>
  </div>

  <div class="exec-grid">
    <div class="exec-card">
      <div class="exec-icon">📊</div>
      <h3>Rastreabilidade Total</h3>
      <p>Cada contrato principal tem seus termos aditivos e apostilamentos organizados e rastreáveis, eliminando retrabalho e buscas manuais em planilhas.</p>
      <div class="stat">100%</div>
    </div>
    <div class="exec-card gold">
      <div class="exec-icon">💰</div>
      <h3>Controle Financeiro</h3>
      <p>Monitoramento das despesas de custeio com três métricas simultâneas: Empenhado, Liquidado e Pago — com alertas automáticos de desvio.</p>
      <div class="stat">3 métricas</div>
    </div>
    <div class="exec-card green">
      <div class="exec-icon">🔗</div>
      <h3>Fonte Oficial</h3>
      <p>Dados alimentados diretamente pelos arquivos mensais do Portal da Transparência de SC, garantindo integridade e confiabilidade das informações.</p>
      <div class="stat">Portal SC</div>
    </div>
  </div>
  <div class="slide-num">02 / 07</div>
</div>


<!-- ══════════════════════════════════════════════
     SLIDE 3 — ESTRUTURA DO SISTEMA
══════════════════════════════════════════════ -->
<div class="slide s3">
  <div class="slide-brand"><span>Governo do Estado de Santa Catarina</span></div>

  <div class="slide-header">
    <div class="slide-kicker">Arquitetura do Sistema</div>
    <div class="slide-title">Três módulos integrados</div>
  </div>

  <div class="arch-grid">
    <div class="arch-card blue">
      <div class="arch-badge">Módulo 01</div>
      <div class="route">/  →  Página Inicial</div>
      <h3>Central de Acesso</h3>
      <p>Ponto de entrada unificado com acesso direto a todos os órgãos e ao painel analítico, sem etapas desnecessárias de navegação.</p>
      <div class="arch-features">
        <div class="arch-feat">Cards dos 9 órgãos monitorados</div>
        <div class="arch-feat">Atalhos rápidos para Contratos e BI</div>
        <div class="arch-feat">Toggle tema claro / escuro</div>
      </div>
    </div>

    <div class="arch-card gold">
      <div class="arch-badge">Módulo 02</div>
      <div class="route">/gestao/:orgao  →  Contratos</div>
      <h3>Gestão Contratual</h3>
      <p>Dashboard operacional por órgão com leitura de planilhas, agrupamento inteligente de documentos e busca integrada.</p>
      <div class="arch-features">
        <div class="arch-feat">Contratos agrupados com vínculos</div>
        <div class="arch-feat">Termos aditivos e apostilamentos</div>
        <div class="arch-feat">Busca por contrato ou documento</div>
      </div>
    </div>

    <div class="arch-card green">
      <div class="arch-badge">Módulo 03</div>
      <div class="route">/analise-custeio  →  Painel BI</div>
      <h3>Análise de Custeio</h3>
      <p>Painel analítico com séries históricas, rankings, alertas e distribuição de despesas por elemento, subelemento e unidade gestora.</p>
      <div class="arch-features">
        <div class="arch-feat">8 visões analíticas independentes</div>
        <div class="arch-feat">Filtros combinados e pesquisa</div>
        <div class="arch-feat">Alertas de variação configuráveis</div>
      </div>
    </div>
  </div>
  <div class="slide-num">03 / 07</div>
</div>


<!-- ══════════════════════════════════════════════
     SLIDE 4 — PAINEL BI
══════════════════════════════════════════════ -->
<div class="slide s4">
  <div class="slide-brand"><span>Governo do Estado de Santa Catarina</span></div>

  <div class="slide-header">
    <div class="slide-kicker">Módulo de Análise</div>
    <div class="slide-title">Painel BI — Despesas de Custeio</div>
  </div>

  <div class="bi-abas">
    ${[
      {n:"Visão Geral",   d:"Série anual e ranking das 10 maiores Unidades Gestoras"},
      {n:"Visão Mensal",  d:"Evolução período a período com variação percentual"},
      {n:"Distribuição",  d:"Participação por subelemento e unidade gestora"},
      {n:"Evolução",      d:"Tendência histórica de gastos por categoria"},
      {n:"Matriz",        d:"Tabela cruzada subelemento × ano em uma visão"},
      {n:"Ranking UG",    d:"Gráfico de linhas das 10 UGs de maior despesa"},
      {n:"Alertas",       d:"Variações acima do limite configurável pelo gestor"},
      {n:"Insights",      d:"Resumo automático dos principais indicadores"},
    ].map(({n,d})=>`
      <div class="bi-aba">
        <strong>${n}</strong>
        <span>${d}</span>
      </div>`).join("")}
  </div>

  <div class="bi-metricas">
    <div class="bi-metrica">
      <div class="bi-metrica-dot" style="background:#2589E8"></div>
      <div><strong>Valor Empenhado</strong><span>Total autorizado no orçamento</span></div>
    </div>
    <div class="bi-metrica">
      <div class="bi-metrica-dot" style="background:#22B98F"></div>
      <div><strong>Valor Liquidado</strong><span>Serviços efetivamente prestados</span></div>
    </div>
    <div class="bi-metrica">
      <div class="bi-metrica-dot" style="background:#E8B84B"></div>
      <div><strong>Valor Pago</strong><span>Recursos efetivamente desembolsados</span></div>
    </div>
  </div>

  <div class="bi-filtros">
    <span class="bi-filtro-label">Filtros disponíveis</span>
    ${["Ano","Período Inicial","Período Final","Elemento de Despesa","Subelemento","Unidade Gestora","Pesquisa livre"].map(f=>`<span class="bi-filtro-tag">${f}</span>`).join("")}
  </div>

  <div class="slide-num">04 / 07</div>
</div>


<!-- ══════════════════════════════════════════════
     SLIDE 5 — CONTRATOS
══════════════════════════════════════════════ -->
<div class="slide s5">
  <div class="slide-brand"><span>Governo do Estado de Santa Catarina</span></div>

  <div class="s5-left">
    <div class="slide-header">
      <div class="slide-kicker">Módulo Operacional</div>
      <div class="slide-title" style="font-size:20px">Gestão de Contratos<br>por Órgão</div>
    </div>

    <div class="flow-steps">
      ${[
        "Acesse o órgão desejado pela página inicial",
        "A planilha do órgão é carregada automaticamente",
        "Contratos são agrupados por objeto/número",
        "Selecione o contrato para ver seus documentos",
        "Termos aditivos e apostilamentos vinculados",
        "Use a busca para filtrar qualquer informação",
      ].map((s,i)=>`
        <div class="flow-step">
          <div class="step-num">${i+1}</div>
          <p>${s}</p>
        </div>`).join("")}
    </div>
  </div>

  <div class="s5-right">
    <div class="slide-header" style="margin-bottom:4px">
      <div class="slide-kicker">Recursos</div>
    </div>
    ${[
      {icon:"🏛️", t:"9 Órgãos",             d:"DETRAN · SEF · SAS · SEJURI e mais"},
      {icon:"☰",  t:"Navegação Rápida",       d:"Menu hambúrguer para trocar órgão"},
      {icon:"🔍", t:"Busca Inteligente",       d:"Filtra contratos e documentos"},
      {icon:"📎", t:"Documentos Vinculados",   d:"Termos aditivos por contrato"},
      {icon:"🌗", t:"Acessibilidade",          d:"Modo claro e escuro integrado"},
    ].map(({icon,t,d})=>`
      <div class="feat-item">
        <div class="feat-icon">${icon}</div>
        <div>
          <strong>${t}</strong>
          <span>${d}</span>
        </div>
      </div>`).join("")}
  </div>
  <div class="slide-num">05 / 07</div>
</div>


<!-- ══════════════════════════════════════════════
     SLIDE 6 — ORIGEM DOS DADOS
══════════════════════════════════════════════ -->
<div class="slide s6">
  <div class="slide-brand"><span>Governo do Estado de Santa Catarina</span></div>

  <div class="slide-header">
    <div class="slide-kicker">Integridade dos Dados</div>
    <div class="slide-title">Origem e fluxo das informações</div>
  </div>

  <div class="data-flow">
    <div class="data-flow-title" style="color:#2589E8">
      <span style="background:#2589E8"></span>
      Painel BI — Despesas de Custeio
    </div>
    <div class="data-flow-row">
      <div class="data-node">
        <strong>Portal da Transparência SC</strong>
        <span>Arquivos ZIP mensais oficiais<br>Despesa + Restos a Pagar</span>
      </div>
      <div class="data-arrow" style="color:#2589E8">→</div>
      <div class="data-node">
        <strong>Script de Sincronização</strong>
        <span>Download automático<br>Parse e validação do CSV</span>
      </div>
      <div class="data-arrow" style="color:#2589E8">→</div>
      <div class="data-node">
        <strong>Cache Consolidado</strong>
        <span>JSON otimizado<br>Schema estrela compacto</span>
      </div>
      <div class="data-arrow" style="color:#2589E8">→</div>
      <div class="data-node">
        <strong>Painel BI</strong>
        <span>Visualização em tempo real<br>Zero dependência de backend</span>
      </div>
    </div>
  </div>

  <div class="data-flow">
    <div class="data-flow-title" style="color:#22B98F">
      <span style="background:#22B98F"></span>
      Gestão de Contratos — Dados por Órgão
    </div>
    <div class="data-flow-row">
      <div class="data-node">
        <strong>Planilhas .xlsx</strong>
        <span>Uma por órgão<br>Dados operacionais</span>
      </div>
      <div class="data-arrow" style="color:#22B98F">→</div>
      <div class="data-node">
        <strong>Leitura no Navegador</strong>
        <span>Biblioteca xlsx<br>Sem upload de arquivos</span>
      </div>
      <div class="data-arrow" style="color:#22B98F">→</div>
      <div class="data-node">
        <strong>Agrupamento Lógico</strong>
        <span>Contratos + documentos<br>vinculados automaticamente</span>
      </div>
      <div class="data-arrow" style="color:#22B98F">→</div>
      <div class="data-node">
        <strong>Dashboard Contratual</strong>
        <span>Cards e tabelas<br>com busca integrada</span>
      </div>
    </div>
  </div>
  <div class="slide-num">06 / 07</div>
</div>


<!-- ══════════════════════════════════════════════
     SLIDE 7 — ENCERRAMENTO
══════════════════════════════════════════════ -->
<div class="slide s7">
  <div class="slide-brand"><span>Governo do Estado de Santa Catarina</span></div>

  <div class="s7-inner">
    <div class="s7-badge">Sistema em operação</div>

    <h2 class="s7-title">Transparência e<br><em>controle</em> em um só lugar</h2>

    <div class="s7-divider"></div>

    <p class="s7-sub">O Painel de Contratos Terceirizados centraliza a gestão operacional e a análise financeira das despesas de custeio do Poder Executivo, com dados diretamente do Portal da Transparência de Santa Catarina.</p>

    <div class="s7-info">
      <div class="s7-info-item">
        <strong>9</strong>
        <span>Órgãos</span>
      </div>
      <div class="s7-sep">·</div>
      <div class="s7-info-item">
        <strong>2021–2026</strong>
        <span>Série histórica</span>
      </div>
      <div class="s7-sep">·</div>
      <div class="s7-info-item">
        <strong>8</strong>
        <span>Visões analíticas</span>
      </div>
      <div class="s7-sep">·</div>
      <div class="s7-info-item">
        <strong>3</strong>
        <span>Métricas financeiras</span>
      </div>
    </div>
  </div>

  <div class="slide-num">07 / 07</div>
</div>

</body>
</html>`;

fs.writeFileSync(outPath, html, "utf-8");
console.log("HTML gerado:", outPath);
