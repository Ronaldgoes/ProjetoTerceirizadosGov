let
    FilePath = "C:\\Users\\rgoes\\Desktop\\ProjetoTerceirizadosGov\\ProjetoTerceirizadosGov\\public\\data\\custeio-oficial.json",
    Source = Json.Document(File.Contents(FilePath), TextEncoding.Utf8),

    FactsRaw = Source[facts],
    FactsTable = Table.FromRows(
        List.Transform(FactsRaw, each List.Transform(_, each _)),
        {
            "Ano",
            "MesNumero",
            "ElementoCode",
            "SubelementoCode",
            "UGCode",
            "Empenhado",
            "Liquidado",
            "Pago"
        }
    ),
    FactsTyped = Table.TransformColumnTypes(
        FactsTable,
        {
            {"Ano", Int64.Type},
            {"MesNumero", Int64.Type},
            {"ElementoCode", type text},
            {"SubelementoCode", type text},
            {"UGCode", type text},
            {"Empenhado", type number},
            {"Liquidado", type number},
            {"Pago", type number}
        }
    ),

    ElementosRaw = Table.FromRecords(Source[elementos]),
    Elementos = Table.TransformColumnTypes(
        Table.RenameColumns(
            ElementosRaw,
            {
                {"code", "ElementoCode"},
                {"name", "ElementoName"},
                {"label", "ElementoLabel"}
            }
        ),
        {
            {"ElementoCode", type text},
            {"ElementoName", type text},
            {"ElementoLabel", type text}
        }
    ),

    SubelementosRaw = Table.FromRecords(Source[subelementos]),
    Subelementos = Table.TransformColumnTypes(
        Table.RenameColumns(
            SubelementosRaw,
            {
                {"code", "SubelementoCode"},
                {"name", "SubelementoName"},
                {"label", "SubelementoLabel"},
                {"elementoCode", "ElementoCodeRef"}
            }
        ),
        {
            {"SubelementoCode", type text},
            {"SubelementoName", type text},
            {"SubelementoLabel", type text},
            {"ElementoCodeRef", type text}
        }
    ),

    UGsRaw = Table.FromRecords(Source[unidades]),
    UGs = Table.TransformColumnTypes(
        Table.RenameColumns(
            UGsRaw,
            {
                {"code", "UGCode"},
                {"name", "UGName"},
                {"label", "UGLabel"}
            }
        ),
        {
            {"UGCode", type text},
            {"UGName", type text},
            {"UGLabel", type text}
        }
    ),

    JoinElemento = Table.NestedJoin(FactsTyped, {"ElementoCode"}, Elementos, {"ElementoCode"}, "Elemento", JoinKind.LeftOuter),
    ExpandElemento = Table.ExpandTableColumn(JoinElemento, "Elemento", {"ElementoName", "ElementoLabel"}, {"ElementoName", "ElementoLabel"}),

    JoinSubelemento = Table.NestedJoin(ExpandElemento, {"SubelementoCode"}, Subelementos, {"SubelementoCode"}, "Subelemento", JoinKind.LeftOuter),
    ExpandSubelemento = Table.ExpandTableColumn(JoinSubelemento, "Subelemento", {"SubelementoName", "SubelementoLabel"}, {"SubelementoName", "SubelementoLabel"}),

    JoinUG = Table.NestedJoin(ExpandSubelemento, {"UGCode"}, UGs, {"UGCode"}, "UG", JoinKind.LeftOuter),
    ExpandUG = Table.ExpandTableColumn(JoinUG, "UG", {"UGName", "UGLabel"}, {"UGName", "UGLabel"}),

    AddDataRef = Table.AddColumn(ExpandUG, "DataRef", each #date([Ano], [MesNumero], 1), type date),
    AddPeriodoKey = Table.AddColumn(AddDataRef, "PeriodoKey", each Text.From([Ano]) & "-" & Text.PadStart(Text.From([MesNumero]), 2, "0"), type text),
    AddMesNome = Table.AddColumn(
        AddPeriodoKey,
        "MesNome",
        each
            if [MesNumero] = 1 then "Jan"
            else if [MesNumero] = 2 then "Fev"
            else if [MesNumero] = 3 then "Mar"
            else if [MesNumero] = 4 then "Abr"
            else if [MesNumero] = 5 then "Mai"
            else if [MesNumero] = 6 then "Jun"
            else if [MesNumero] = 7 then "Jul"
            else if [MesNumero] = 8 then "Ago"
            else if [MesNumero] = 9 then "Set"
            else if [MesNumero] = 10 then "Out"
            else if [MesNumero] = 11 then "Nov"
            else "Dez",
        type text
    ),
    AddMesAno = Table.AddColumn(AddMesNome, "MesAno", each [MesNome] & "/" & Text.From([Ano]), type text),

    Reordered = Table.ReorderColumns(
        AddMesAno,
        {
            "DataRef",
            "PeriodoKey",
            "Ano",
            "MesNumero",
            "MesNome",
            "MesAno",
            "ElementoCode",
            "ElementoName",
            "ElementoLabel",
            "SubelementoCode",
            "SubelementoName",
            "SubelementoLabel",
            "UGCode",
            "UGName",
            "UGLabel",
            "Empenhado",
            "Liquidado",
            "Pago"
        }
    )
in
    Reordered
