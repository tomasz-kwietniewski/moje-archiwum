# Historia wersji

## Wtyczka Brave i program Windows

| Wersja | Data | Zmiana |
| --- | --- | --- |
| 0.1 | 2026-09-23 | Pierwsza wersja z `showDirectoryPicker`. Nie działała w Brave, który wyłącza File System Access API. Test przechodził tylko dlatego, że podstawiał atrapę tej funkcji - nauczka: test nie może maskować brakującego API przeglądarki. |
| 0.2 | 2026-09-23 | Lokalny program Windows przez Native Messaging: okno wyboru folderu i zapis bez nadpisywania. |
| 0.3.0 | 2026-09-24 | Obrazy offline w `<nazwa>_assets`, obsługa typu `image/jpg`. |
| 0.3.1 | 2026-09-25 | Pusty temat przy każdej notatce, lista istniejących folderów, **+ Nowy temat**. |
| 0.3.2 | 2026-09-25 | Zdjęcie główne spoza bloku artykułu w trybie **Sam artykuł**. |
| 0.4.0 | 2026-09-25 | Wspólne wektory reguł nazw dla JS, C# i Javy, limity długości nazw i ścieżek, zapis z brakującymi obrazami jako linkami (za zgodą), odfiltrowanie ikon i pikseli śledzących, kontrola zgodności skryptu Androida w CI. |
| 0.4.1 | 2026-09-25 | Puste linki po usuniętych ikonach (np. Facebook, YouTube pod artykułem) nie zostają w notatce jako `[](...)`. |
| 0.4.2 | 2026-09-26 | Miękkie dywizy (U+00AD) usuwane z tytułu i treści - psuły wyszukiwanie słów w archiwum. |
| 0.4.3 | 2026-09-28 | Apostrof `'` w tytule zamieniany w nazwie pliku na typograficzny `’`: klient Synology Drive pomija ścieżki z `'` (nie wysyła, nie pobiera, tworzy konflikty). |
| 0.4.4 | 2026-09-28 | Obrazy z nawiasem w adresie (np. `filters:format(webp)`) dawały się zapisać tylko jako linki: Turndown zapisuje nawiasy w adresie jako `\(` `\)` (poprawny CommonMark), a program Windows pobierał adres razem z ukośnikami. Wymaga ponownego uruchomienia `Zainstaluj-w-Brave.bat` (przebudowa programu). |
| 0.4.5 | 2026-10-07 | Pole tematu podpowiada temat ostatnio zapisanej notatki (tylko gdy folder nadal istnieje; zaznaczony, więc wpisanie innej nazwy go zastępuje). Okno edytora wyśrodkowane nad przeglądarką i nie wyższe od niej, cały formularz z przyciskiem **Zapisz notatkę** mieści się bez przewijania. |
| 0.4.6 | 2026-11-07 | Oferty pracy: na początku notatki blok **Dane oferty** (wynagrodzenie, umowa, tryb, miejsce, daty). Readability pomija krótki nagłówek oferty, więc dane pochodzą z `JobPosting` (schema.org), a na Pracuj.pl także z nagłówka, bo tylko tam jest tryb pracy. Daty w czasie polskim. Inne strony bez zmian. |

2026-10-02, bez zmiany numeru: przy pierwszym wyborze okno folderu programu Windows otwiera się w Dokumentach (wcześniej na dysku `D:\`, jeśli istniał).

## Aplikacja Android

| Wersja | Zmiana |
| --- | --- |
| 0.1 | Udostępnianie z Brave, zapis przez systemowy wybór folderu (SAF). |
| 0.2.0 - 0.2.1 | Obrazy offline, `image/jpg`. |
| 0.2.2 | Wygląd spójny z wtyczką. |
| 0.3.0 | Skrypt przechwytywania zgodny z wtyczką 0.4.0 (zdjęcie główne, filtr ikon), zapis z brakującymi obrazami za zgodą, obrazy `http` pobierane przez `https`, reguły nazw zgodne z JS. |
| 0.3.1 | Po udanym zapisie komunikat i automatyczny powrót do przeglądarki; przycisk **×** w nagłówku. |
| 0.3.2 | Skrypt przechwytywania zgodny z wtyczką 0.4.2 (bez miękkich dywizów). |
| 0.3.3 | Apostrof `'` w nazwie pliku zamieniany na `’`, jak we wtyczce 0.4.3. |
| 0.3.4 | Adres obrazu z ucieczkami Markdown (`\(` `\)`) pobierany bez ukośników, jak w programie Windows 0.4.4. |
| 0.3.5 | Pole Temat podpowiada tematy archiwum (wpisujesz „kosz”, wybierasz „Koszykówka”, także bez polskich znaków). Listę `_tematy.txt` zapisuje w skrzynce `_Z telefonu` skrypt na komputerze. |
| 0.3.6 | Skrypt przechwytywania zgodny z wtyczką 0.4.6 (blok **Dane oferty** w ofertach pracy). |

## Skrypt skrzynki z telefonu

| Data | Zmiana |
| --- | --- |
| 2026-10-02 | Pierwsza wersja: przenoszenie notatek ze skrzynki `_Z telefonu` do tematów, lista tematów `_tematy.txt` dla telefonu. Powód: aplikacja Synology Drive na Androidzie (3.8.1) nie umiała zsynchronizować archiwum z ok. 15 tys. folderów `_assets` (błąd 167), także w trybie tylko wysyłania. |
