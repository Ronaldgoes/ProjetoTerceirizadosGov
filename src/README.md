# Estrutura atual do src

- `App.jsx`: entrada visual simples da aplicacao.
- `main.jsx`: ponto de montagem do React.
- `app/AppRouter.jsx`: concentrador de rotas.
- `components/ContractsTable.jsx`: tabela principal de contratos e documentos.
- `data/organs.js`: lista central dos orgaos e arquivos XLSX.
- `pages/OrgansHomePage.jsx`: tela inicial do site.
- `pages/ContractsDashboardPage.jsx`: dashboard por orgao, com menu lateral, busca e rotas de contratos.
- `pages/CusteioDashboard.jsx`: painel BI com dados oficiais do portal.
- `styles/Dashboard.css`: estilos principais do sistema.
- `utils/formatters.js`: formatacao de valores, datas e links da planilha.
- `utils/textHelpers.js`: normalizacao de texto e geracao de slug.
- `utils/contractGroups.js`: agrupamento dos documentos por contrato.
- `utils/workbookImport.js`: leitura e padronizacao das planilhas XLSX.

## Observacoes

- A navegacao principal esta separada por responsabilidade, o que facilita manutencao no VS Code.
- A regra de agrupamento dos contratos agora fica isolada em um utilitario proprio.
- A leitura da planilha tambem foi isolada, evitando concentrar tudo em um unico componente.
