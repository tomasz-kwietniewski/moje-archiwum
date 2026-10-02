param([string]$ExtensionId)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$hostName = 'pl.tomaszkwietniewski.moje_archiwum'
$hostPath = Join-Path $project 'native\MojeArchiwumHost.exe'
$manifestPath = Join-Path $project 'native\host.json'
$compiler = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Nie znaleziono kompilatora .NET Framework w Windows.' }

if (-not $ExtensionId) {
    $profiles = Get-ChildItem -LiteralPath "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data" -Filter 'Secure Preferences' -Recurse -ErrorAction SilentlyContinue
    $matches = @()
    foreach ($profile in $profiles) {
        try {
            $prefs = Get-Content -LiteralPath $profile.FullName -Raw | ConvertFrom-Json
            foreach ($item in $prefs.extensions.settings.PSObject.Properties) {
                if ($item.Value.path -eq (Join-Path $project 'dist')) { $matches += $item.Name }
            }
        } catch { }
    }
    $matches = @($matches | Select-Object -Unique)
    if ($matches.Count -eq 1) { $ExtensionId = $matches[0] }
}
if (-not $ExtensionId) {
    Write-Host 'Otworz brave://extensions, wlacz tryb dewelopera i skopiuj ID wtyczki Moje archiwum - Markdown.'
    $ExtensionId = Read-Host 'ID wtyczki'
}
if ($ExtensionId -cnotmatch '^[a-p]{32}$') { throw 'ID wtyczki musi miec 32 litery od a do p.' }

& $compiler /nologo /target:exe "/out:$hostPath" /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll (Join-Path $project 'native\Program.cs')
if ($LASTEXITCODE -ne 0) { throw 'Nie udalo sie zbudowac pomocniczego programu Windows.' }

$manifest = @{
    name = $hostName
    description = 'Lokalny zapis notatek Markdown w wybranym folderze'
    path = $hostPath
    type = 'stdio'
    allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 3
[IO.File]::WriteAllText($manifestPath, $manifest, (New-Object System.Text.UTF8Encoding($false)))
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
New-Item -Path $registryPath -Force | Out-Null
Set-Item -Path $registryPath -Value $manifestPath

Write-Host "Zainstalowano lokalny program dla wtyczki $ExtensionId"
Write-Host "Program: $hostPath"
Write-Host "Manifest: $manifestPath"
Write-Host 'W brave://extensions kliknij przy wtyczce przycisk Odswiez, potem sprobuj Wybierz folder.'
