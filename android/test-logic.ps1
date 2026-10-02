$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $project 'app\src'
$output = Join-Path $project 'app\build\logic-test'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$compiler = (Get-Command javac.exe -ErrorAction Stop).Source
$runtime = Join-Path (Split-Path -Parent $compiler) 'java.exe'
$package = 'pl\tomaszkwietniewski\moje_archiwum'
& $compiler -encoding UTF-8 -d $output `
    (Join-Path $source "main\java\$package\NoteFormat.java") `
    (Join-Path $source "main\java\$package\ShareInput.java") `
    (Join-Path $source "main\java\$package\ImageLinks.java") `
    (Join-Path $source "main\java\$package\TopicList.java") `
    (Join-Path $source "test\java\$package\LogicTest.java")
if ($LASTEXITCODE -ne 0) { throw 'Kompilacja testu Java nie powiodła się.' }
& $runtime -cp $output pl.tomaszkwietniewski.moje_archiwum.LogicTest (Join-Path (Split-Path -Parent $project) 'tests\vectors\rules.tsv')
if ($LASTEXITCODE -ne 0) { throw 'Test logiki Android nie przeszedł.' }
