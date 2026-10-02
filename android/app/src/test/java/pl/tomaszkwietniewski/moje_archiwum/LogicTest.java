package pl.tomaszkwietniewski.moje_archiwum;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class LogicTest {
    private static void eq(Object expected, Object actual) {
        if (!java.util.Objects.equals(expected, actual)) throw new AssertionError("Expected " + expected + ", got " + actual);
    }

    private static void fails(Runnable action) {
        try { action.run(); } catch (IllegalArgumentException expected) { return; }
        throw new AssertionError("Expected IllegalArgumentException");
    }

    private static String unescape(String value) {
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c != '\\' || i + 1 == value.length()) { out.append(c); continue; }
            char next = value.charAt(++i);
            if (next == 'u' && i + 4 < value.length()) { out.append((char) Integer.parseInt(value.substring(i + 1, i + 5), 16)); i += 4; }
            else out.append(next == 't' ? '\t' : next == 'n' ? '\n' : next);
        }
        return out.toString();
    }

    // Shared with src/core.js and native/Program.cs; see tests/vectors/rules.tsv.
    private static int vectors(String path) throws IOException {
        int checked = 0;
        for (String line : Files.readAllLines(Paths.get(path), StandardCharsets.UTF_8)) {
            if (line.isEmpty() || line.startsWith("#")) continue;
            String[] raw = line.split("\t", -1);
            String[] v = new String[raw.length];
            for (int i = 0; i < raw.length; i++) v[i] = unescape(raw[i]);
            String context = " in vector: " + line;
            switch (v[0]) {
                case "title":
                    if (!v[2].equals(NoteFormat.safeTitle(v[1]))) throw new AssertionError("title " + NoteFormat.safeTitle(v[1]) + context);
                    break;
                case "date":
                    if (!NoteFormat.filename("x", Instant.parse(v[1])).startsWith(v[2] + "_")) throw new AssertionError("date" + context);
                    break;
                case "topic-ok": eq(v[1], NoteFormat.validTopic(v[1])); break;
                case "topic-bad": fails(() -> NoteFormat.validTopic(v[1])); break;
                case "images": {
                    List<String> urls = new ArrayList<>();
                    for (ImageLinks.Reference reference : ImageLinks.find(v[1])) urls.add(reference.url);
                    if (!urls.equals(Arrays.asList(v).subList(2, v.length))) throw new AssertionError("images " + urls + context);
                    break;
                }
                case "images-bad": fails(() -> ImageLinks.find(v[1])); break;
                case "fit": case "fit-bad": continue; // Windows MAX_PATH applies to the Windows host only.
                default: throw new AssertionError("Unknown vector kind" + context);
            }
            checked++;
        }
        return checked;
    }

    public static void main(String[] args) throws IOException {
        eq("https://example.com/a?x=1", ShareInput.firstUrl("Artykuł https://example.com/a?x=1."));
        eq("https://example.com/x", ShareInput.firstUrl("https://example.com/x"));
        eq(true, ShareInput.canFetch("https://example.com"));
        eq(false, ShareInput.canFetch("http://example.com"));
        eq("2026-09-24_Tytuł_3.md", NoteFormat.uniqueFilename("Tytuł", Instant.parse("2026-09-23T23:30:00Z"),
                Set.of("2026-09-24_Tytuł.md", "2026-09-24_Tytuł_2.md")));
        eq("2026-09-24_Tytuł_2.md", NoteFormat.uniqueFilename("Tytuł", Instant.parse("2026-09-23T23:30:00Z"),
                Set.of("2026-09-24_tytuł.md")));
        String markdown = NoteFormat.markdown("Tytuł", "https://example.com", "# Treść", Instant.parse("2026-09-24T12:00:00Z"));
        if (!markdown.contains("title: \"Tytuł\"\n") || !markdown.contains("source: \"https://example.com\"\n")
                || !markdown.contains("created: \"2026-09-24T12:00:00.000Z\"\n") || !markdown.endsWith("# Treść\n"))
            throw new AssertionError(markdown);
        fails(() -> NoteFormat.markdown("Tytuł", "", " ", Instant.now()));
        String images = "![A](https://example.com/a(1).jpg) [link](https://example.com/page) " +
                "![B](https://example.com/b.png) ![A](https://example.com/a(1).jpg)";
        List<ImageLinks.Reference> references = ImageLinks.find(images);
        eq(images.replace("https://example.com/a(1).jpg", "2026-09-24_Tytuł_assets/001.jpg")
                .replace("https://example.com/b.png", "2026-09-24_Tytuł_assets/002.png"),
                ImageLinks.rewrite(images, references, Map.of(
                        "https://example.com/a(1).jpg", "2026-09-24_Tytuł_assets/001.jpg",
                        "https://example.com/b.png", "2026-09-24_Tytuł_assets/002.png")));
        // An image skipped with the user's consent stays as an internet link.
        eq(images.replace("https://example.com/a(1).jpg", "2026-09-24_Tytuł_assets/001.jpg"),
                ImageLinks.rewrite(images, references, Map.of("https://example.com/a(1).jpg", "2026-09-24_Tytuł_assets/001.jpg")));
        // Turndown escapes parentheses; the whole escaped address is replaced by the local file.
        String escaped = "![x](https://example.com/format\\(webp\\)/a.jpeg)";
        eq("![x](2026-09-24_Tytuł_assets/001.jpeg)", ImageLinks.rewrite(escaped, ImageLinks.find(escaped),
                Map.of("https://example.com/format(webp)/a.jpeg", "2026-09-24_Tytuł_assets/001.jpeg")));
        eq("https://example.com/obraz.png", ImageLinks.httpsVariant("http://example.com/obraz.png"));
        eq(null, ImageLinks.httpsVariant("https://example.com/obraz.png"));
        // Topic list written by scripts/telefon-skrzynka.mjs into the phone inbox.
        List<String> topics = TopicList.parse("﻿Koszykówka\r\nPiłka nożna\n\n  Sport  \nzły/temat\nKoszykówka\n.ukryty\n");
        eq(List.of("Koszykówka", "Piłka nożna", "Sport"), topics);
        eq(List.of("Koszykówka"), TopicList.matching(topics, "kosz"));
        eq(List.of("Koszykówka"), TopicList.matching(topics, "koszykowka"));
        eq(List.of("Piłka nożna"), TopicList.matching(topics, "pilka noz"));
        eq(List.of("Piłka nożna", "Sport"), TopicList.matching(List.of("Sport", "Piłka nożna"), "p"));
        eq(List.of(), TopicList.matching(topics, "golf"));
        eq(topics, TopicList.matching(topics, ""));
        int checked = vectors(args.length > 0 ? args[0] : "tests/vectors/rules.tsv");
        if (checked < 40) throw new AssertionError("Too few shared vectors: " + checked);
        System.out.println("LogicTest: OK, shared vectors: " + checked);
    }
}
