# Moje archiwum - notatki ze stron WWW jako zwykłe pliki Markdown

*English summary: a small, local web clipper. A Brave/Chromium extension (with a tiny Windows helper)
and an Android app save the article you are reading as a plain Markdown file with offline images,
into a folder you choose. No account, no server, no subscription. Documentation is in Polish.*

Zestaw narzędzi do prowadzenia własnego archiwum przeczytanych artykułów w zwykłych plikach
Markdown, bez konta, serwera i abonamentu. Powstał jako następca Evernote i Joplina: notatki to
pliki na Twoim dysku, czytelne w każdym edytorze (VS Code, Obsidian, Notatnik), a synchronizację
zapewnia dowolne narzędzie do synchronizacji folderów.

W repozytorium są trzy części:

| Część | Co robi |
| --- | --- |
| **Wtyczka do Brave** (`src/`, `manifest.json`) z **programem pomocniczym Windows** (`native/`) | Zapisuje otwartą stronę jako notatkę Markdown z obrazami offline. Wtyczka wybiera treść artykułu i robi z niej Markdown, program Windows zapisuje pliki we wskazanym folderze. |
| **Aplikacja Android** (`android/`) | Pozycja **Moje archiwum** w menu **Udostępnij** przeglądarki. Pobiera artykuł, pozwala poprawić tytuł, temat i treść, zapisuje notatkę w folderze telefonu. |
| **Skrzynka z telefonu** (`scripts/telefon-skrzynka.mjs`) | Opcjonalny skrypt na komputer: przenosi notatki zapisane na telefonie z małego folderu-skrzynki do tematów archiwum. |

Wszystko działa lokalnie. Konwersję robią [Mozilla Readability](https://github.com/mozilla/readability)
(wybór treści artykułu) i [Turndown](https://github.com/mixmark-io/turndown) (HTML do Markdown).
Kod nie wysyła nigdzie Twoich notatek; jedyny ruch sieciowy to pobranie strony i jej obrazów.

## Jak wygląda archiwum

```text
Archiwum/
  Energetyka/
    2026-09-23_Jak zwiększyć autokonsumpcję.md
    2026-09-23_Jak zwiększyć autokonsumpcję_assets/
      001.jpg
      002.png
    2026-09-23_Jak zwiększyć autokonsumpcję_2.md
  Piłka nożna/
    ...
```

- Temat to zwykły folder bezpośrednio w archiwum.
- Nazwa notatki to `RRRR-MM-DD_Tytuł.md`. Data to dzień zapisu w strefie Europe/Warsaw.
- Obrazy z treści leżą obok notatki w folderze `<nazwa notatki>_assets`, a linki do nich są względne,
  więc notatkę da się czytać offline i przenosić razem z folderem.
- Na początku pliku jest nagłówek YAML z tytułem, datą zapisu (UTC) i adresem źródła:

```markdown
---
title: "Jak zwiększyć autokonsumpcję"
created: "2026-09-23T08:15:02.000Z"
updated: "2026-09-23T08:15:02.000Z"
source: "https://example.com/artykul"
---

Treść artykułu...

![](2026-09-23_Jak%20zwi%C4%99kszy%C4%87%20autokonsumpcj%C4%99_assets/001.jpg)
```

- Nic nie jest nadpisywane. Powtórny zapis tej samej strony dostaje końcówkę `_2`, `_3` itd.
- Reguły nazw (niedozwolone znaki Windows, nazwy zarezerwowane, limity długości, apostrof zamieniany
  na `’`) są wspólne dla wtyczki, programu Windows i Androida. Sprawdza je jeden zestaw przypadków
  w [`tests/vectors/rules.tsv`](tests/vectors/rules.tsv).

## Wymagania

- Windows 10 lub 11 z wbudowanym .NET Framework 4 (program pomocniczy kompiluje się wbudowanym
  `csc.exe`, bez instalowania Visual Studio).
- Brave. Wtyczka korzysta ze standardowego mechanizmu Chromium, więc powinna działać też w Chrome,
  ale testowana była w Brave; instalator sam znajduje ID wtyczki tylko w profilach Brave.
- [Node.js](https://nodejs.org/) 22 lub nowszy do zbudowania wtyczki.
- Do aplikacji Android: JDK 17 i Android SDK (szczegóły w [android/README.md](android/README.md)).

## Instalacja wtyczki w Brave

W PowerShell, w katalogu repozytorium:

```powershell
npm.cmd ci
npm.cmd run build
```

1. Otwórz w Brave `brave://extensions` i włącz **Tryb dewelopera**.
2. Kliknij **Załaduj rozpakowane** i wskaż katalog `dist` tego repozytorium.
3. Uruchom dwuklikiem **Zainstaluj-w-Brave.bat**. Instalator kompiluje program pomocniczy
   `native\MojeArchiwumHost.exe` i rejestruje go dla Twojego konta Windows (klucz w `HKCU`, bez
   uprawnień administratora) jako host [Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
   dla ID zainstalowanej wtyczki. Gdy nie znajdzie ID sam, poprosi o skopiowanie go z `brave://extensions`.
4. Kliknij przy wtyczce **Odśwież** i przypnij ją do paska.
5. Otwórz artykuł, kliknij ikonę wtyczki, a potem **Wybierz folder** i wskaż folder archiwum.
   Program zapamięta go w `%LOCALAPPDATA%\MojeArchiwum\folder.txt`.

Nie przenoś katalogu `dist` ani `native` po instalacji. Jeśli to zrobisz, uruchom instalator ponownie,
bo zmienia się ścieżka programu, a często też ID wtyczki.

**Dlaczego osobny program Windows?** Brave [wyłącza File System Access API](https://github.com/brave/brave-browser/wiki/Deviations-from-Chromium-%28features-we-disable-or-remove%29),
więc wtyczka nie może sama zapisywać plików w wybranym folderze. Program pomocniczy otwiera okno
wyboru folderu i zapisuje notatki. Ma około 400 linii C#, możesz go przeczytać w [`native/Program.cs`](native/Program.cs).

## Codzienne użycie

- Otwórz stronę i kliknij ikonę wtyczki (albo **Ctrl+Shift+Y**; skrót zmienisz na `brave://extensions/shortcuts`).
- Wybierz temat z listy istniejących folderów albo kliknij **+ Nowy temat**. Bez tematu zapis jest nieaktywny.
- Sprawdź tytuł i Markdown. **Sam artykuł** wybiera tekst i zdjęcie główne, **Cała strona** to opcja
  awaryjna (dochodzą menu i polecane materiały). Markdown możesz poprawić przed zapisem.
- Kliknij **Zapisz notatkę**. Gdy któregoś obrazu nie da się pobrać, pojawi się przycisk
  **Zapisz bez brakujących obrazów** - brakujące zostaną linkami internetowymi.

Szczegóły i limity obrazów: [docs/obrazy-offline.md](docs/obrazy-offline.md).

## Czytanie archiwum

Archiwum to zwykły folder, więc wystarczy dowolny edytor Markdown:

- **VS Code**: **Plik > Otwórz folder**, **Ctrl+P** szuka po nazwie, **Ctrl+Shift+F** w treści,
  **Ctrl+Shift+V** pokazuje podgląd.
- **Obsidian**: otwórz folder archiwum jako sejf (vault). Przy dziesiątkach tysięcy plików trzymaj
  archiwum na dysku SSD - na wolnym dysku talerzowym pierwsze wczytanie potrafi przekroczyć limit czasu Obsidiana.

## Telefon i skrzynka

Aplikacja Android zapisuje notatki w wybranym folderze telefonu w tym samym układzie co wtyczka.
Instalacja i budowanie: [android/README.md](android/README.md).

Najprościej synchronizować z telefonem całe archiwum. Gdy narzędzie do synchronizacji nie radzi sobie
z dużą liczbą plików na telefonie (tak było u autora przy ok. 135 tys. plików), można synchronizować
tylko małą **skrzynkę**: podfolder `_Z telefonu` w archiwum. Telefon zapisuje do niej notatki,
a komputer co kilka minut przenosi je do właściwych tematów:

- `scripts/telefon-skrzynka.mjs` czyta folder archiwum z `%LOCALAPPDATA%\MojeArchiwum\folder.txt`
  (ustawia go wtyczka), przenosi notatkę razem z obrazami do `Temat\`, przy kolizji nazwy dopisuje `_2`
  i poprawia linki, a identyczną kopię tylko usuwa ze skrzynki. Czeka, aż notatka ma co najmniej
  2 minuty i dotarły wszystkie jej obrazy.
- Zapisuje też w skrzynce `_tematy.txt` - listę tematów archiwum, z której aplikacja na telefonie
  podpowiada tematy przy wpisywaniu.
- Dziennik przeniesień i błędów: `%LOCALAPPDATA%\MojeArchiwum\z-telefonu.log`.

Uruchamianie co 5 minut bez okna konsoli (Harmonogram zadań Windows), w PowerShell z katalogu repozytorium:

```powershell
$akcja = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$PWD\scripts\telefon-skrzynka-ukryty.vbs`""
$wyzwalacz = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName 'MojeArchiwum - skrzynka z telefonu' -Action $akcja -Trigger $wyzwalacz
```

Synchronizację skrzynki między telefonem a komputerem ustaw dwukierunkowo: wtedy przeniesienie notatki
na komputerze opróżnia skrzynkę także w telefonie.

## Zrób własną wersję

Kod jest na licencji MIT - możesz go zmieniać i rozpowszechniać. Jeśli budujesz własny wariant,
zmień identyfikatory, żeby nie kolidował z oryginałem:

- nazwa hosta Native Messaging `pl.tomaszkwietniewski.moje_archiwum` w `src/native.js`
  i `install-brave.ps1` (oraz w testach `tests/`);
- `namespace` i `applicationId` w `android/app/build.gradle` (i pakiet Java w `android/app/src/`);
- katalog ustawień `%LOCALAPPDATA%\MojeArchiwum` w `native/Program.cs` i `scripts/telefon-skrzynka.mjs`.

Dobre miejsca na zmiany: reguły nazw i nagłówka w `src/core.js` (oraz ich odpowiedniki w C# i Javie -
wspólne wektory w `tests/vectors/rules.tsv` pilnują, żeby się nie rozjechały), wybór treści
w `src/capture.js`, edytor w `src/editor.*`.

## Rozwój i testy

```powershell
npm.cmd ci
npm.cmd test                    # testy jednostkowe (node --test)
npm.cmd run build               # wtyczka do dist/
npx.cmd playwright install chromium
npm.cmd run test:e2e            # edytor i przechwytywanie w prawdziwym Chromium
npm.cmd run test:android-asset  # kopia skryptu przechwytywania w aplikacji Android jest aktualna
npm.cmd run test:android-logic  # reguły nazw w Javie (zwykły javac, bez Android SDK)
npm.cmd run test:native         # program Windows: zapis, obrazy, sprzątanie po błędzie
npm.cmd run test:brave          # prawdziwy Brave z testowym hostem Native Messaging
```

`test:native` wymaga wcześniej zbudowanego programu (robi to `Zainstaluj-w-Brave.bat` albo polecenie
`csc.exe` z [`.github/workflows/test.yml`](.github/workflows/test.yml)). `test:brave`, `test:picker`
i `test:installed` wymagają zainstalowanego Brave. Po zmianie `src/capture.js` uruchom
`npm.cmd run build:android-assets`, bo aplikacja Android ma własną kopię tego skryptu.

Historia wersji: [CHANGELOG.md](CHANGELOG.md).

## Ograniczenia

- To nie jest kopia zapasowa. Program nie usuwa ani nie nadpisuje notatek, ale o kopię archiwum
  zadbaj osobno.
- Zapisywana jest treść już załadowana w karcie. Wtyczka nie przewija strony i nie obchodzi
  logowania ani płatnego dostępu. Aplikacja Android pobiera stronę sama, po adresie, więc strony
  wymagające logowania zapisze gorzej niż wtyczka.
- Automatyczne rozpoznanie artykułu nie jest bezbłędne - sprawdź podgląd przed zapisem.
- Program pomocniczy działa tylko w Windows.

## Licencja

Kod tego repozytorium: [MIT](LICENSE). Dołączone biblioteki mają własne licencje: Readability
(Apache 2.0), Turndown i turndown-plugin-gfm (MIT). Ich teksty trafiają do `dist/licenses/` przy
budowaniu wtyczki i są w `android/app/src/main/assets/licenses/`.

Autor: [Tomasz Kwietniewski](https://tomaszkwietniewski.pl/).
