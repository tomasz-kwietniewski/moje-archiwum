' Runs scripts\telefon-skrzynka.mjs without a console window; started by Task Scheduler every 5 minutes.
Set fso = CreateObject("Scripting.FileSystemObject")
script = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "telefon-skrzynka.mjs")
CreateObject("WScript.Shell").Run "node """ & script & """", 0, True
