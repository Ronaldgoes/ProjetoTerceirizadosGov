# Power BI do Custeio

## Objetivo
Transformar o dashboard atual de custeio em um relatório Power BI com o mesmo raciocínio analítico:
- visão anual
- visão mensal
- distribuição
- ranking
- matriz
- evolução
- alertas

Base usada no projeto atual:
- arquivo: `public/data/custeio-oficial.json`
- fonte: Portal da Transparência SC
- grupo: natureza 33, outras despesas correntes

## Estrutura recomendada

### Tabela fato
Nome: `fCusteio`

Campos mínimos:
- `Ano`
- `MesNumero`
- `PeriodoKey`
- `DataRef`
- `ElementoCode`
- `ElementoName`
- `ElementoLabel`
- `SubelementoCode`
- `SubelementoName`
- `SubelementoLabel`
- `UGCode`
- `UGName`
- `UGLabel`
- `Empenhado`
- `Liquidado`
- `Pago`

Mapeamento do JSON atual:
- `year` -> `Ano`
- `month` -> `MesNumero`
- `elementoCode` -> `ElementoCode`
- `elementoName` -> `ElementoName`
- `subelementoCode` -> `SubelementoCode`
- `subelementoName` -> `SubelementoName`
- `unidadeGestoraCode` -> `UGCode`
- `unidadeGestoraName` -> `UGName`
- `vlempenhado` -> `Empenhado`
- `vlliquidado` -> `Liquidado`
- `vlpago` -> `Pago`

Colunas calculadas na carga:
- `PeriodoKey = FORMAT(DATE([Ano],[MesNumero],1),"YYYY-MM")`
- `DataRef = DATE([Ano],[MesNumero],1)`
- `ElementoLabel = [ElementoCode] & " - " & [ElementoName]`
- `SubelementoLabel = [SubelementoCode] & " - " & [SubelementoName]`
- `UGLabel = [UGCode] & " - " & [UGName]`

### Dimensão calendário
Nome: `dCalendario`

Campos:
- `Data`
- `Ano`
- `MesNumero`
- `MesNome`
- `MesAno`
- `PeriodoKey`
- `Trimestre`
- `AnoMesOrdem`

Relacionamento:
- `dCalendario[Data]` 1:* `fCusteio[DataRef]`

### Dimensões auxiliares
Opcional, mas recomendável:
- `dElemento`
- `dSubelemento`
- `dUG`
- `dMetrica`

## Parâmetro de métrica
Criar uma tabela desconectada:

`dMetrica`
- `Metrica = "Empenhado"`
- `Metrica = "Liquidado"`
- `Metrica = "Pago"`

Usar slicer único para trocar a métrica em todo o relatório.

## Medidas DAX principais

### Base
```DAX
Valor Selecionado =
SWITCH(
    SELECTEDVALUE(dMetrica[Metrica], "Empenhado"),
    "Empenhado", SUM(fCusteio[Empenhado]),
    "Liquidado", SUM(fCusteio[Liquidado]),
    "Pago", SUM(fCusteio[Pago]),
    SUM(fCusteio[Empenhado])
)

Valor Empenhado = SUM(fCusteio[Empenhado])
Valor Liquidado = SUM(fCusteio[Liquidado])
Valor Pago = SUM(fCusteio[Pago])
```

### Tempo
```DAX
Valor Mês Anterior =
CALCULATE(
    [Valor Selecionado],
    DATEADD(dCalendario[Data], -1, MONTH)
)

Valor Ano Anterior =
CALCULATE(
    [Valor Selecionado],
    DATEADD(dCalendario[Data], -1, YEAR)
)

Variação Mensal % =
DIVIDE([Valor Selecionado] - [Valor Mês Anterior], [Valor Mês Anterior])

Variação Anual % =
DIVIDE([Valor Selecionado] - [Valor Ano Anterior], [Valor Ano Anterior])
```

### Participação
```DAX
Participação % =
DIVIDE(
    [Valor Selecionado],
    CALCULATE([Valor Selecionado], ALLSELECTED(fCusteio))
)

Participação % por Visual =
DIVIDE(
    [Valor Selecionado],
    CALCULATE([Valor Selecionado], ALLSELECTED())
)
```

### Ranking
```DAX
Ranking UG =
RANKX(
    ALLSELECTED(fCusteio[UGLabel]),
    [Valor Selecionado],
    ,
    DESC,
    DENSE
)

Ranking Subelemento =
RANKX(
    ALLSELECTED(fCusteio[SubelementoLabel]),
    [Valor Selecionado],
    ,
    DESC,
    DENSE
)
```

### Top N
```DAX
UG Top 10 =
IF([Ranking UG] <= 10, [Valor Selecionado])

Subelemento Top 10 =
IF([Ranking Subelemento] <= 10, [Valor Selecionado])
```

### Período inicial e final do recorte
```DAX
Data Inicial Seleção =
MINX(ALLSELECTED(dCalendario), dCalendario[Data])

Data Final Seleção =
MAXX(ALLSELECTED(dCalendario), dCalendario[Data])

Valor Período Inicial =
VAR _data = [Data Inicial Seleção]
RETURN
CALCULATE([Valor Selecionado], KEEPFILTERS(dCalendario[Data] = _data))

Valor Período Final =
VAR _data = [Data Final Seleção]
RETURN
CALCULATE([Valor Selecionado], KEEPFILTERS(dCalendario[Data] = _data))

Variação Recorte % =
DIVIDE([Valor Período Final] - [Valor Período Inicial], [Valor Período Inicial])
```

### Pico da série
```DAX
Pico da Série =
MAXX(
    VALUES(dCalendario[PeriodoKey]),
    [Valor Selecionado]
)
```

### Alertas
Criar parâmetro What-if:
- `pAlerta[% Limite]`

```DAX
Em Alerta % =
VAR _var = [Variação Mensal %]
VAR _limite = SELECTEDVALUE('pAlerta'[% Limite Value], 0.1)
RETURN IF(ABS(_var) >= _limite, 1, 0)
```

## Páginas recomendadas

### 1. Resumo Executivo
Visuais:
- cartões: valor total, valor inicial, valor final, variação do recorte
- linha mensal
- barras anuais
- top 10 UGs
- top 10 subelementos

Filtros:
- métrica
- período inicial
- período final
- elemento
- subelemento
- UG

### 2. Visão Anual
Visuais:
- colunas por ano
- tabela de variação anual
- cards de destaque
- ranking UG anual
- ranking subelemento anual

Medidas usadas:
- `Valor Selecionado`
- `Variação Anual %`
- `Pico da Série`

### 3. Visão Mensal
Visuais:
- colunas por mês
- linha por mês
- tabela de variação mensal
- comparativo entre primeiro e último mês do recorte
- cards: mês de maior gasto, maior variação, dominante do mês

### 4. Distribuição
Visuais:
- rosca por subelemento
- rosca por UG
- tabela relacionada para drillthrough

Observação:
o comportamento de “clicar em um lado e destacar o relacionado no outro” não fica idêntico ao React, mas pode ser aproximado com:
- interações visuais
- tooltip page
- drillthrough

### 5. Ranking
Visuais:
- ranking de subelementos
- ranking de UGs
- cartões laterais de detalhe

Recursos:
- Top N
- participação %
- destaque do item selecionado via bookmarks ou seleção visual

### 6. Matriz
Visuais:
- matriz por subelemento x ano
- matriz por UG x ano

Recursos:
- pesquisa
- formatação condicional por intensidade

### 7. Evolução
Visuais:
- linha Top 10 UGs
- linha Top 10 Subelementos
- toggle por bookmarks:
  - `Ver UGs`
  - `Ver Subelementos`
- cards:
  - dominante no período
  - total top 10 no período
  - pico da série

### 8. Alertas
Visuais:
- tabela de variação acima do limite
- tabela de desvio contra média histórica
- cartões de insight

Recursos:
- parâmetro What-if para percentual limite
- segmentação por agrupamento:
  - UG
  - subelemento
  - elemento

## Filtros globais do relatório
Usar slicers sincronizados:
- métrica
- ano
- intervalo de datas
- elemento
- subelemento
- UG

## Recursos do Power BI que substituem a lógica do app
- `Bookmarks` para alternar UGs/Subelementos na evolução
- `Field parameters` para trocar medidas e eixos
- `What-if parameter` para alertas
- `Tooltip pages` para detalhamento leve
- `Drillthrough` para páginas de detalhe
- `Edit interactions` para controle fino entre visuais

## Limitações em relação ao BI web
O que não fica igual sem custom visual:
- reset por clique fora
- alguns comportamentos muito específicos de hover
- narrativa automática igual à do app
- exportações PDF/JPG do jeito customizado atual

## Ordem prática de construção
1. Carregar `custeio-oficial.json` no Power Query
2. Explodir a matriz de registros em colunas
3. Criar `dCalendario`
4. Criar `dMetrica`
5. Criar medidas base
6. Montar páginas: Resumo, Anual, Mensal
7. Montar Distribuição, Ranking e Matriz
8. Montar Evolução e Alertas
9. Aplicar tema
10. Refinar interações e bookmarks

## Entregáveis prontos neste repositório
- especificação: `docs/powerbi-custeio.md`
- tema: `powerbi/theme-custeio.json`

## Próximo passo recomendado
Criar no Power BI Desktop primeiro estas páginas:
1. Resumo Executivo
2. Visão Mensal
3. Evolução

Essas três já cobrem a maior parte do valor do painel atual.
