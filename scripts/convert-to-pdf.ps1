$app = New-Object -ComObject PowerPoint.Application
$app.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
$ppt = $app.Presentations.Open("C:\Users\ronal\OneDrive\Desktop\ProjetoTerceirizadosGov\Apresentacao-PainelGov.pptx")
$ppt.SaveAs("C:\Users\ronal\OneDrive\Desktop\ProjetoTerceirizadosGov\Apresentacao-PainelGov.pdf", 32)
$ppt.Close()
$app.Quit()
Write-Host "PDF gerado com sucesso!"
