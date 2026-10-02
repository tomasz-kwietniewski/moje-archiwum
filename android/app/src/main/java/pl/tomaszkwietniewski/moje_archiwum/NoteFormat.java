package pl.tomaszkwietniewski.moje_archiwum;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Set;
import java.util.regex.Pattern;

public final class NoteFormat {
    private static final Pattern INVALID = Pattern.compile("[<>:\"/\\\\|?*\\x00-\\x1f]");
    private static final Pattern RESERVED = Pattern.compile("(?i)^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\\.|$)");
    // Same whitespace set as JavaScript \s and String.trim(), so names match src/core.js exactly.
    private static final String WHITESPACE = "[\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]";
    private static final Pattern SPACES = Pattern.compile(WHITESPACE + "+");
    private static final Pattern EDGES = Pattern.compile("^" + WHITESPACE + "+|" + WHITESPACE + "+$");
    // Limits shared with src/core.js and checked by tests/vectors/rules.tsv (255-byte file name limit).
    private static final int MAX_TITLE_CHARS = 120;
    private static final int MAX_TITLE_BYTES = 180;
    private static final DateTimeFormatter DATE =DateTimeFormatter.ofPattern("uuuu-MM-dd");
    private static final DateTimeFormatter UTC = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);

    private NoteFormat() {}

    static String trim(String value) { return EDGES.matcher(value).replaceAll(""); }

    public static String safeTitle(String value) {
        // The ASCII apostrophe becomes the typographic one: Synology Drive skips paths with ' (2026-09-27).
        String normalized = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFC).replace('\'', '\u2019');
        String name = trim(SPACES.matcher(INVALID.matcher(normalized).replaceAll(" ")).replaceAll(" ")).replaceAll("[. ]+$", "");
        if (name.codePointCount(0, name.length()) > MAX_TITLE_CHARS) name = name.substring(0, name.offsetByCodePoints(0, MAX_TITLE_CHARS));
        while (name.getBytes(StandardCharsets.UTF_8).length > MAX_TITLE_BYTES)
            name = name.substring(0, name.offsetByCodePoints(name.length(), -1));
        name = name.replaceAll("[. ]+$", "");
        if (name.isEmpty()) name = "Bez tytułu";
        return RESERVED.matcher(name).find() ? "_" + name : name;
    }

    public static String validTopic(String value) {
        if (value == null || trim(value).isEmpty() || !value.equals(trim(value)) || INVALID.matcher(value).find()
                || value.matches(".*[. ]$") || RESERVED.matcher(value).find() || value.equals("_resources")
                || value.startsWith(".") || value.length() > 100) {
            throw new IllegalArgumentException("Podaj nazwę tematu bez ukośników i znaków niedozwolonych w Windows (maks. 100 znaków).");
        }
        return value;
    }

    public static String filename(String title, Instant instant) {
        return DATE.format(instant.atZone(ZoneId.of("Europe/Warsaw"))) + "_" + safeTitle(title) + ".md";
    }

    public static String uniqueFilename(String title, Instant instant, Set<String> existing) {
        String base = filename(title, instant);
        String stem = base.substring(0, base.length() - 3);
        String chosen = base;
        for (int suffix = 2; containsIgnoreCase(existing, chosen); suffix++) chosen = stem + "_" + suffix + ".md";
        return chosen;
    }

    private static boolean containsIgnoreCase(Set<String> existing, String candidate) {
        for (String name : existing) if (name.equalsIgnoreCase(candidate)) return true;
        return false;
    }

    public static String markdown(String title, String source, String body, Instant instant) {
        if (body == null || body.trim().isEmpty()) throw new IllegalArgumentException("Notatka jest pusta. Uzupełnij treść.");
        String url = source == null ? "" : source.trim();
        if (!url.isEmpty()) {
            try {
                URI uri = URI.create(url);
                if (!("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme())) || uri.getHost() == null)
                    throw new IllegalArgumentException("Podaj poprawny adres strony.");
            } catch (IllegalArgumentException error) { throw new IllegalArgumentException("Podaj poprawny adres strony."); }
        }
        String timestamp = UTC.format(instant);
        String heading = title == null || title.trim().isEmpty() ? "Bez tytułu" : title.trim();
        return "---\n" +
                "title: " + jsonString(heading) + "\n" +
                "created: " + jsonString(timestamp) + "\n" +
                "updated: " + jsonString(timestamp) + "\n" +
                "source: " + jsonString(url) + "\n" +
                "---\n\n" + body.trim() + "\n";
    }

    static String jsonString(String text) {
        StringBuilder out = new StringBuilder("\"");
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            switch (c) {
                case '"': out.append("\\\""); break;
                case '\\': out.append("\\\\"); break;
                case '\n': out.append("\\n"); break;
                case '\r': out.append("\\r"); break;
                case '\t': out.append("\\t"); break;
                default:
                    if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
                    else out.append(c);
            }
        }
        return out.append('"').toString();
    }
}
