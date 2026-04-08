# Apresentação do Sistema

## Tema Visual Recomendado

- Estilo: futurista, limpo, institucional e tecnológico.
- Paleta: azul profundo, azul elétrico, branco, cinza grafite e detalhes dourados discretos.
- Tipografia: títulos fortes, corpo limpo e espaçado.
- Linguagem: clara, objetiva e explicativa.
- Direção visual: interface como protagonista, pouco texto por bloco e bastante destaque para prints.

## Estrutura Recomendada

### Slide 1. Capa

**Título**
Painel Gov SC  
Gestão de Terceirizados, Custeio e Monitoramento Inteligente

**Subtítulo**
Plataforma integrada para acompanhamento operacional, análise de despesas e geração de alertas estratégicos.

**Visual sugerido**
- Fundo escuro com brilho azul suave.
- Print de destaque da tela inicial ou da tela de análise de custeio ocupando boa parte do slide.

**Mensagem principal**
O sistema centraliza acesso, leitura analítica e monitoramento contínuo de informações relevantes para a gestão pública.

---

### Slide 2. Objetivo do Sistema

**Título**
Propósito da Solução

**Texto**
O site foi desenvolvido para concentrar, em um único ambiente, as principais necessidades de consulta e acompanhamento da gestão:

- acesso rápido às áreas do sistema;
- análise de custeio com filtros avançados;
- acompanhamento de contratos por órgão;
- monitoramento contínuo de itens críticos;
- geração de notificações automáticas com base em variações relevantes;
- controle de acesso com perfis de usuário e administrador.

**Mensagem de apoio**
Mais do que um painel visual, a plataforma funciona como um ambiente de inteligência operacional para apoio à tomada de decisão.

**Print sugerido**
- Tela inicial do sistema.

---

### Slide 3. Arquitetura Funcional do Site

**Título**
Como o Sistema Está Organizado

**Texto**
O sistema está dividido em módulos principais:

- Página inicial com atalhos rápidos.
- Login e controle de acesso.
- Painel BI de Análise de Custeio.
- Aba de Monitoramento com regras personalizadas.
- Sino de notificações inteligentes.
- Área administrativa para gestão de usuários.
- Área operacional por órgão para contratos e documentos.

**Mensagem de apoio**
Cada módulo tem uma função específica, mas todos se conectam para formar uma experiência única e integrada.

**Visual sugerido**
- Diagrama simples em fluxo:
  Início -> Login -> Painel BI / Monitoramento / Contratos / Admin

---

### Slide 4. Página Inicial

**Título**
Tela Inicial e Navegação Principal

**Texto**
A página inicial funciona como a central de entrada do sistema. Ela apresenta os principais atalhos para navegação:

- Gestão Contratual.
- Painel BI.
- Monitoramento.
- Administração, quando o usuário possui perfil de administrador.

**O que a tela faz**
- direciona rapidamente o usuário para a área desejada;
- reduz cliques e facilita o uso diário;
- apresenta uma navegação simples, limpa e institucional.

**Print sugerido**
- Tela inicial completa, mostrando os cards de acesso.

**Legenda para o print**
Tela inicial com os principais módulos do sistema disponíveis para navegação.

---

### Slide 5. Login e Controle de Sessão

**Título**
Acesso Seguro e Sessão Controlada

**Texto**
O acesso ao sistema é feito por autenticação com e-mail institucional.

**Regras implementadas**
- apenas e-mails do domínio institucional podem acessar;
- o usuário pode entrar ou criar conta;
- a sessão utiliza persistência por aba/janela;
- se a página for fechada, o login é encerrado;
- ao sair do sistema, os dados temporários da sessão também são limpos.

**Valor da funcionalidade**
Isso melhora a segurança do acesso e evita que o sistema permaneça aberto indefinidamente em sessões esquecidas.

**Print sugerido**
- Tela de login.

**Legenda para o print**
Área de autenticação com validação de domínio institucional e controle de sessão.

---

### Slide 6. Sincronização Automática com o Portal

**Título**
Sincronização Inteligente no Login

**Texto**
Sempre que o usuário realiza login, o sistema dispara uma sincronização automática com a base do portal.

**O que acontece nesse processo**
- a aplicação consulta a base oficial;
- atualiza os períodos mais recentes;
- monta um patch de atualização da sessão atual;
- aplica esse patch sobre a base local exibida no painel;
- passa a trabalhar com a informação mais recente disponível naquele acesso.

**Diferencial**
O usuário não depende mais de apertar um botão manual para atualizar os dados.

**Mensagem de apoio**
A atualização fica mais fluida, mais confiável e mais aderente ao uso real da plataforma.

**Print sugerido**
- Topo do Painel BI mostrando status de sincronização.

**Legenda para o print**
Indicadores que mostram quando a sincronização ocorreu e até qual período a base oficial está atualizada.

---

### Slide 7. Painel BI de Análise de Custeio

**Título**
Centro de Inteligência Analítica

**Texto**
O Painel BI é o núcleo analítico da plataforma. Ele reúne os dados de custeio e permite diferentes leituras da execução orçamentária.

**Principais recursos**
- seleção da fase da despesa;
- filtro por período inicial e final;
- filtros por elementos, subelementos e unidades gestoras;
- pesquisa global;
- limpeza rápida de filtros;
- leitura consolidada por cards, rankings, tabelas, matrizes e gráficos.

**O que o painel entrega**
Uma visão comparativa, evolutiva e distribuída do custeio, permitindo identificar concentração de gastos, tendências e mudanças relevantes.

**Print sugerido**
- Visão geral do Painel BI com filtros e cards superiores.

---

### Slide 8. Filtros Avançados do Painel BI

**Título**
Leitura Personalizada dos Dados

**Texto**
Os filtros permitem adaptar a análise ao recorte que o usuário precisa.

**Explicação por item**
- Fase da Despesa: alterna entre empenhamento, liquidação e pagamento.
- Período Inicial e Final: define o intervalo analisado.
- Elementos: permite limitar a leitura por classificação da despesa.
- Subelementos: refina ainda mais a análise.
- Unidades Gestoras: restringe a consulta por órgão ou unidade responsável.
- Pesquisa Global: cruza termos em múltiplas dimensões ao mesmo tempo.

**Benefício**
Transforma uma base extensa em uma leitura objetiva e direcionada ao contexto de gestão.

**Print sugerido**
- Área de filtros do painel em destaque.

---

### Slide 9. Abas Analíticas do Painel BI

**Título**
Múltiplas Formas de Leitura

**Texto**
O Painel BI foi estruturado em abas para facilitar diferentes formas de interpretação.

**Abas disponíveis**
- Visão Anual: comparação consolidada por ano.
- Visão Mensal: evolução e variações mês a mês.
- Distribuição: leitura por composição e concentração.
- Ranking: identificação dos maiores valores.
- Matriz: cruzamento analítico entre dimensões e anos.
- Evolução: acompanhamento temporal das principais unidades gestoras.
- Alertas: leitura de desvios e variações acima dos limites definidos.

**Mensagem de apoio**
Cada aba responde a uma pergunta diferente da gestão.

**Print sugerido**
- Faixa de abas do painel e uma tela com gráficos ativos.

---

### Slide 10. Indicadores e Leitura de Variações

**Título**
Indicadores Visuais e Apoio à Interpretação

**Texto**
O sistema utiliza indicadores visuais para tornar a leitura mais intuitiva.

**Exemplos**
- cards com totais consolidados;
- tabelas de variação;
- indicadores de diferença percentual;
- emojis para leitura rápida de dissonância;
- rankings e destaques de maior impacto;
- comparativos entre períodos.

**Resultado**
O usuário entende mais rapidamente o comportamento da despesa, sem depender apenas de leitura técnica de planilhas.

**Print sugerido**
- Tabela de variação ou cards de indicadores.

---

### Slide 11. Área de Gestão Contratual por Órgão

**Título**
Consulta Operacional de Contratos

**Texto**
A área de contratos organiza documentos e informações contratuais por órgão.

**Como funciona**
- o usuário escolhe um órgão;
- o sistema carrega os registros vinculados àquele órgão;
- os contratos aparecem agrupados em cards;
- ao entrar em um contrato específico, o usuário vê apenas os documentos relacionados a ele;
- existe busca textual para localizar contratos ou documentos com rapidez.

**Valor da funcionalidade**
Essa área aproxima a operação do dia a dia, permitindo encontrar informações contratuais de forma muito mais ágil.

**Print sugerido**
- Lista de contratos de um órgão.
- Print complementar opcional da tela interna de um contrato.

---

### Slide 12. Aba de Monitoramento

**Título**
Monitoramento Personalizado por Regra

**Texto**
A aba de Monitoramento foi criada para que o usuário acompanhe itens específicos de interesse.

**O que pode ser monitorado**
- Órgão ou Unidade Gestora;
- Elemento de Despesa;
- Subelemento.

**Configurações disponíveis**
- escolha do item a ser monitorado;
- definição da métrica: empenhamento, liquidação ou pagamento;
- definição do limite percentual de alerta;
- definição do período monitorado com data inicial e final.

**Mensagem de apoio**
O monitoramento deixa de ser genérico e passa a refletir a realidade que cada usuário quer acompanhar.

**Print sugerido**
- Aba de Monitoramento mostrando lista lateral e cards monitorados.

---

### Slide 13. Regras de Período no Monitoramento

**Título**
Monitoramento com Intervalo Definido

**Texto**
Agora cada item monitorado possui um período específico de análise.

**O que isso significa**
- o usuário escolhe o recorte temporal de interesse;
- o cálculo do valor atual do monitor considera apenas esse intervalo;
- as notificações também respeitam esse mesmo período;
- isso evita alertas fora do contexto desejado.

**Exemplo de uso**
É possível monitorar um subelemento apenas de janeiro de 2024 até dezembro de 2024, sem interferência de meses fora desse recorte.

**Print sugerido**
- Card de monitoramento mostrando métrica, threshold e período monitorado.

---

### Slide 14. Notificações Inteligentes

**Título**
Alertas Automáticos com Explicação

**Texto**
Sempre que o usuário faz login e ocorre sincronização, o sistema reavalia os itens monitorados.

**Regra de disparo**
- o sistema compara os dados mais recentes do intervalo monitorado com o período anterior;
- se a variação ultrapassar o percentual configurado pelo usuário;
- uma notificação é criada automaticamente.

**O que a notificação informa**
- item monitorado;
- percentual de variação;
- valores comparados;
- período analisado;
- resumo explicativo em linguagem clara.

**Exemplo de resumo**
Em abril de 2026, determinado órgão registrou certo valor em pagamento, mais ou menos X% que março de 2026, dentro do período monitorado.

**Print sugerido**
- Sino de notificações aberto mostrando um alerta com resumo.

---

### Slide 15. Leitura Explicativa e Tomada de Decisão

**Título**
Do Dado Bruto à Interpretação

**Texto**
Um diferencial importante do sistema é que ele não apenas mostra números.
Ele também orienta a interpretação.

**Como isso aparece**
- resumos de variação dentro das notificações;
- leituras comparativas entre períodos;
- destaques de maior variação;
- identificação de líderes de gasto por unidade e subelemento;
- evidências de concentração ou desvio.

**Benefício**
Isso reduz o esforço analítico manual e ajuda a transformar informação em ação.

**Print sugerido**
- Aba de Alertas do Painel BI ou notificação explicativa.

---

### Slide 16. Área Administrativa

**Título**
Governança de Usuários e Perfis

**Texto**
A área administrativa permite controlar quem acessa o sistema e quais usuários possuem privilégios ampliados.

**Recursos da tela**
- listagem de usuários cadastrados;
- identificação de administradores;
- resumo do total de usuários;
- busca por nome, e-mail ou perfil;
- promoção ou remoção de perfil administrador.

**Importância**
Essa camada garante governança mínima sobre o ambiente, mantendo controle sobre acesso e permissões.

**Print sugerido**
- Painel administrativo.

---

### Slide 17. Experiência de Navegação

**Título**
Navegação Unificada e Produtiva

**Texto**
O site foi pensado para ser usado no cotidiano, com navegação simples e consistente.

**Pontos de destaque**
- topo unificado com acesso rápido às áreas principais;
- botão de início;
- nome do usuário visível;
- sino de notificações integrado;
- logout simples;
- proteção de rotas para áreas restritas.

**Resultado**
O usuário encontra rapidamente o que precisa sem se perder entre telas.

**Print sugerido**
- TopBar em alguma tela protegida.

---

### Slide 18. Benefícios para a Gestão

**Título**
Ganhos Práticos da Plataforma

**Texto**
Os principais benefícios da solução são:

- centralização da informação;
- redução de esforço manual;
- atualização automática no login;
- monitoramento ativo de itens críticos;
- leitura visual e explicativa dos dados;
- apoio à priorização e à tomada de decisão;
- mais governança de acesso e uso institucional.

**Mensagem de fechamento**
O sistema combina operação, análise e monitoramento em um único ambiente.

---

### Slide 19. Evolução e Próximos Passos

**Título**
Possibilidades de Expansão

**Texto**
Com a base atual, a solução já suporta futuras evoluções com bastante potencial.

**Exemplos**
- relatórios executivos automáticos;
- envio de alertas por e-mail;
- dashboards por órgão com perfis específicos;
- histórico de sincronizações;
- painéis comparativos por unidade;
- mais inteligência textual para resumos analíticos.

**Mensagem**
O projeto já tem uma base sólida para crescer como plataforma de inteligência de gestão.

---

### Slide 20. Encerramento

**Título**
Conclusão

**Texto**
O site entrega uma experiência integrada de gestão pública digital:

- acesso seguro;
- atualização automática;
- análise detalhada;
- monitoramento configurável;
- alertas explicativos;
- governança administrativa.

**Frase final sugerida**
Uma solução pensada para transformar acompanhamento operacional em inteligência prática de gestão.

---

## Lista de Prints Recomendados

1. Tela inicial.
2. Tela de login.
3. Topo do Painel BI com status de sincronização.
4. Painel BI completo.
5. Área de filtros do Painel BI.
6. Abas analíticas do Painel BI.
7. Tabela ou card de variação.
8. Lista de contratos por órgão.
9. Tela interna de um contrato.
10. Aba de Monitoramento com cards.
11. Card de monitoramento com período monitorado.
12. Sino de notificações aberto.
13. Aba de Alertas do BI.
14. Painel administrativo.
15. TopBar com navegação e usuário.

## Ordem Ideal dos Prints

- Começar com visão institucional e navegação.
- Depois mostrar acesso e sincronização.
- Em seguida apresentar o BI.
- Depois mostrar contratos.
- Depois monitoramento e notificações.
- Finalizar com administração e benefícios.

## Sugestão de Uso no Gamma ou Canva

Se quiser transformar este roteiro em slides visuais com IA:

- no Gamma: usar este conteúdo como base de apresentação e escolher tema escuro tecnológico;
- no Canva: usar modelo corporativo futurista e inserir os prints em blocos amplos;
- no PowerPoint: manter muito contraste, pouco texto por coluna e imagens grandes.

## Observação Importante

Este roteiro foi escrito com base na estrutura real do projeto:

- página inicial;
- autenticação com sessão controlada;
- sincronização automática no login;
- painel de análise de custeio;
- monitoramento por item, métrica e período;
- notificações com resumos explicativos;
- gestão contratual por órgão;
- área administrativa.
