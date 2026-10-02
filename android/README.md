# Moje archiwum na Androidzie

Aplikacja pojawia się w menu **Udostępnij** przeglądarki (testowana z Brave na Androidzie). Pobiera publiczny artykuł HTTPS, pokazuje tytuł i Markdown do poprawienia, a potem zapisuje `Temat/RRRR-MM-DD_Tytuł.md` w wybranym folderze telefonu. Obrazy z notatki pobiera do sąsiedniego folderu `RRRR-MM-DD_Tytuł_assets`, dzięki czemu można czytać ją offline. Korzysta z tego samego Readability i Turndown co wtyczka komputerowa i z tych samych reguł nazw plików. Nie wymaga konta ani serwera.

Historia wersji: [CHANGELOG.md](../CHANGELOG.md).

## Użycie

1. W przeglądarce otwórz artykuł HTTPS i wybierz **Udostępnij > Moje archiwum**.
2. Sprawdź tytuł, temat i treść. Pole **Temat** podpowiada tematy archiwum, jeśli w wybranym folderze leży plik `_tematy.txt` (zapisuje go skrypt skrzynki na komputerze, opis w [głównym README](../README.md#telefon-i-skrzynka)); wielkość liter i polskie znaki nie mają znaczenia. Nowy temat można po prostu wpisać. W razie potrzeby popraw Markdown lub naciśnij **Wstaw całą stronę**.
3. Przy pierwszym zapisie wybierz folder na telefonie: całe archiwum albo skrzynkę `_Z telefonu`, jeśli synchronizujesz tylko ją. Wskaż zwykły lokalny folder, który synchronizuje Twoje narzędzie (Synology Drive, Syncthing, Dysk Google z folderem lokalnym itp.), a nie wirtualną lokalizację aplikacji w chmurze. Android 11 i nowsze nie pozwalają wskazać całego głównego katalogu telefonu ani `Download`. Aplikacja zapamięta dostęp do folderu.
4. Kolejne zapisy tej samej strony dostają numer `_2`, `_3` itd. zamiast nadpisywać notatkę. Po udanym zapisie aplikacja pokazuje krótki komunikat „Zapisano w <temat>” i sama wraca do przeglądarki. Gdy zapis się nie uda, okno zostaje otwarte z opisem błędu. Przycisk **×** w nagłówku zamyka aplikację bez zapisu.

Przycisk **Wybierz folder na telefonie** otwiera systemowy wybór katalogu Androida. Pokazuje tylko lokalizacje udostępnione przez dostawców plików; aplikacja nie może wymusić pokazania folderu serwera. Zapis lokalny działa bez sieci, a narzędzie do synchronizacji wysyła gotowe pliki później. [Dokumentacja Androida](https://developer.android.com/training/data-storage/shared/documents-files) opisuje systemowy wybór drzewa folderów.

Udostępnienie przekazuje adres strony, a nie wyświetloną już treść. Dlatego strony po zalogowaniu lub silnie dynamiczne mogą nie zostać prawidłowo pobrane. Możesz wtedy ręcznie wkleić tekst do pola Markdown. Jeśli któregoś obrazu nie da się pobrać, aplikacja zapyta, czy zapisać notatkę bez niego; brakujący obraz zostanie wtedy linkiem internetowym. Obrazy `http://` są pobierane przez HTTPS, bo Android blokuje nieszyfrowany ruch. Szczegóły i limity: [obrazy offline](../docs/obrazy-offline.md).

## Budowanie

Wymagane: JDK 17 lub JDK dołączone do Android Studio, Android SDK Platform 35 i Build-Tools 35.0.0 oraz Node.js. Do instalacji na telefonie potrzebne są też Android SDK Platform-Tools (ADB). Android Studio jest wygodnym instalatorem SDK, ale nie musi być uruchomione podczas budowania. W PowerShell ustaw JDK i SDK (poniżej domyślne lokalizacje Android Studio), a potem z katalogu głównego repozytorium uruchom:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA "Android\Sdk"
npm.cmd ci
npm.cmd run build:android-assets
cd android
.\gradlew.bat assembleDebug
```

APK powstanie w `android\app\build\outputs\apk\debug\` jako `MojeArchiwum-Android-v<wersja>-test.apk`. Numer wersji w nazwie jest pobierany z konfiguracji Gradle. To debugowy APK do własnego użytku, a nie podpisana wersja wydawnicza.

### Instalacja przez ADB

Nie trzeba publikować aplikacji w Sklepie Play. Instalacja przez Android Debug Bridge działa także na telefonach z Ochroną zaawansowaną Google, która może blokować zwykłe otwarcie pliku APK na telefonie.

1. Na telefonie włącz **Opcje programisty** (zwykle 7 dotknięć pozycji **Numer kompilacji**) i **Debugowanie USB**.
2. Podłącz telefon kablem USB, odblokuj go i potwierdź komunikat o zaufaniu do tego komputera.
3. W PowerShell z katalogu głównego repozytorium:

   ```powershell
   $adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
   & $adb devices
   & $adb install -r (Get-ChildItem .\android\app\build\outputs\apk\debug\*.apk | Select-Object -First 1).FullName
   ```

   Pierwsze polecenie powinno pokazać telefon w stanie `device`. Jeśli pokazuje `unauthorized`, zatwierdź komunikat na telefonie i uruchom je ponownie. Po instalacji możesz wyłączyć Debugowanie USB.

Aktualizacje instalujesz tak samo (`install -r`). Nie usuwaj aplikacji przed aktualizacją, jeśli chcesz zachować wybrany folder.

## Testy bez telefonu

```powershell
npm.cmd test
npm.cmd run test:android-asset
npm.cmd run test:android-logic
```

`test:android-asset` sprawdza, że `app/src/main/assets/capture.js` odpowiada aktualnemu `src/capture.js` wtyczki; po zmianie tamtego pliku uruchom `npm.cmd run build:android-assets`. Test logiki nazw korzysta ze zwykłego `javac` bez Android SDK i sprawdza te same przypadki `tests/vectors/rules.tsv` co wtyczka i program Windows. Pełny przepływ (udostępnienie, zapis) wymaga telefonu lub emulatora.
