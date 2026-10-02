# Obrazy w notatkach offline

Cel: notatka zapisana w Brave lub na Androidzie zachowuje tekst i obrazy z zapisanej treści bez połączenia z internetem.

## Format

- Plik Markdown leży w folderze tematu. Obok niego powstaje folder `<nazwa-notatki>_assets` z obrazami tej notatki: `001.jpg`, `002.png` itd.
- Odnośniki obrazów są względne wobec pliku notatki (nazwa folderu zakodowana jak w URL, np. `%20` zamiast spacji). Adres źródłowy strony zostaje w metadanych.
- Powtórny zapis dostaje nową nazwę notatki i nowy folder obrazów. Istniejące notatki i obrazy nie są nadpisywane.
- Pobierane są obrazy przywołane w końcowej, edytowanej treści Markdown. Ten sam adres pobiera się raz na notatkę.
- Przy odczycie strony pomijane są obrazy do 48 × 48 px: przyciski udostępniania, logotypy, ikony i piksele śledzące. Rozmiar sprawdzany jest na obrazie faktycznie wyświetlonym; dla obrazów ładowanych leniwie liczą się atrybuty `width` i `height`. Link, w którym po usunięciu ikony nie zostaje tekst ani obraz, jest usuwany razem z nią.

## Gdy obrazu nie da się pobrać

- Najpierw zapis się nie udaje, a komunikat podaje, ile obrazów zawiodło i przykładowy adres. Nic nie zostaje na dysku.
- Wtyczka pokazuje przycisk **Zapisz bez brakujących obrazów**, Android pyta w oknie dialogowym. Po zgodzie notatka zostaje zapisana, pobrane obrazy są lokalne, a brakujące zostają linkami internetowymi. Komunikat po zapisie podaje ich liczbę.
- Każda zmiana treści, tytułu lub tematu wycofuje tę propozycję: nowa treść jest sprawdzana od początku.
- Limit 15 MiB na obraz oraz 100 MiB i 100 różnych obrazów na notatkę chroni miejsce na telefonie i komputerze. Obraz ponad limit liczy się jako niepobrany; ponad 100 obrazów to błąd.
- Wspierane typy: JPEG (także `image/jpg`), PNG, GIF, WebP, AVIF, BMP i SVG.
- Android blokuje nieszyfrowany HTTP, dlatego obraz `http://` pobiera spod `https://`, tak jak przeglądarka przy treści mieszanej. Jeśli serwer nie ma HTTPS, obraz jest niepobrany.
- Nie pobieramy obrazów wymagających logowania, jeśli serwer odmawia osobnego pobrania pliku.

## Sprawdzenie

- `npm run test:native`: zapis z obrazami, pełne sprzątanie po błędzie, zapis za zgodą z linkiem do brakującego obrazu, brak pustego folderu `_assets`, skracanie długich ścieżek.
- `npm run test:e2e`: przycisk w edytorze wtyczki (z zamiennikiem hosta) oraz filtr ikon w prawdziwym Chromium.
- `npm run test:brave`: prawdziwy Brave z programem Windows zapisuje Markdown i obraz w katalogu testowym.
- Android: `npm run test:android-logic` (podmiana linków, HTTPS) i ręczny zapis na telefonie do folderu testowego.
