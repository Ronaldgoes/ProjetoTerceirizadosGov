# Estrutura de pastas do src

- `App.jsx`: componente raiz do dashboard. Gerencia seleção de órgão, leitura de planilha XLSX e estado global.
- `main.jsx`: ponto de entrada do React (renderiza `<App />`).
- `App.css`, `index.css`: estilos base.
- `assets/`: imagens, logos, arquivos estáticos da aplicação.
- `pages/`:
  - `TableView.jsx`: tabela de contratos e detalhes expandidos.
  - `SummaryView.jsx`: cards de resumo por empresa (KPIs).
- `styles/`:
  - `Dashboard.css`: estilos do layout geral do dashboard.
- `utils/`:
  - `formatters.js`: funções de formatação (BRL, números, datas) e mapeamento de colunas.

## Observações gerais
- A app usa React Router para navegação entre `SelecaoOrgao` (inicial) e `DashboardLayout` (por órgão).
- Os dados são carregados de planilhas em `public/planilhas` via `fetch`.
- Cada órgão tem um resumo local salvo em estado (`resumos` por ID do órgão).