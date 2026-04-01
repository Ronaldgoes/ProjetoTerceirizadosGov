# Estrutura atual do src

- `App.jsx`: entrada visual simples da aplicação.
- `main.jsx`: ponto de montagem do React.
- `app/AppRouter.jsx`: concentrador de rotas.
- `components/ContractsTable.jsx`: tabela principal de contratos e documentos.
- `data/organs.js`: lista central dos órgãos e arquivos XLSX.
- `pages/OrgansHomePage.jsx`: tela inicial do site.
- `pages/ContractsDashboardPage.jsx`: dashboard por órgão, com menu lateral, busca e rotas de contratos.
- `pages/CusteioDashboard.jsx`: painel BI com dados oficiais do portal.
- `styles/Dashboard.css`: estilos principais do sistema.
- `utils/formatters.js`: formatação de valores, datas e links da planilha.
- `utils/textHelpers.js`: normalização de texto e geração de slug.
- `utils/contractGroups.js`: agrupamento dos documentos por contrato.
- `utils/workbookImport.js`: leitura e padronização das planilhas XLSX.

## Observações

- A navegação principal está separada por responsabilidade, o que facilita manutenção no VS Code.
- A regra de agrupamento dos contratos agora fica isolada em um utilitário próprio.
- A leitura da planilha também foi isolada, evitando concentrar tudo em um único componente.
