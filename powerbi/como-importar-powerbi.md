# Como importar no Power BI

## 1. Criar a fato
1. Abra o Power BI Desktop.
2. Va em `Transformar dados`.
3. Clique em `Nova fonte` > `Consulta nula`.
4. Abra `Editor Avancado`.
5. Cole o conteudo de [custeio-power-query.m](/C:/Users/rgoes/Desktop/ProjetoTerceirizadosGov/ProjetoTerceirizadosGov/powerbi/custeio-power-query.m).
6. Se precisar, ajuste apenas a linha `FilePath`.
7. Salve a consulta com o nome `fCusteio`.
8. Clique em `Fechar e aplicar`.

## 2. Criar as tabelas e medidas
1. Va em `Modelagem`.
2. Clique em `Nova tabela` e cole a parte `dMetrica`.
3. Clique em `Nova tabela` e cole a parte `dCalendario`.
4. Depois clique em `Nova medida` e va colando as medidas do arquivo [custeio-medidas.dax](/C:/Users/rgoes/Desktop/ProjetoTerceirizadosGov/ProjetoTerceirizadosGov/powerbi/custeio-medidas.dax).

## 3. Criar relacionamento
Crie o relacionamento:
- `dCalendario[Date]` -> `fCusteio[DataRef]`

## 4. Aplicar o tema
1. Va em `Exibicao`
2. `Temas` > `Procurar temas`
3. Escolha [theme-custeio.json](/C:/Users/rgoes/Desktop/ProjetoTerceirizadosGov/ProjetoTerceirizadosGov/powerbi/theme-custeio.json)

## 5. Primeira pagina recomendada
Monte primeiro:
- slicer `dMetrica[Metrica]`
- slicer `dCalendario[MesAno]` ou intervalo por `dCalendario[Date]`
- cartao `[Valor Selecionado]`
- cartao `[Valor Periodo Inicial]`
- cartao `[Valor Periodo Final]`
- cartao `[Variacao Recorte %]`
- grafico de colunas por `dCalendario[MesAno]`
- ranking top 10 por `fCusteio[UGLabel]`
- ranking top 10 por `fCusteio[SubelementoLabel]`

## 6. Dica importante
Na `dCalendario`, marque `MesAno` para ordenar por `AnoMesOrdem`.
