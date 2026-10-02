package pl.tomaszkwietniewski.moje_archiwum;

import java.net.URI;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class ShareInput {
    private static final Pattern LINK = Pattern.compile("https?://[^\\s<>\"']+", Pattern.CASE_INSENSITIVE);

    private ShareInput() {}

    public static String firstUrl(String text) {
        if (text == null) return null;
        Matcher match = LINK.matcher(text);
        while (match.find()) {
            String value = match.group().replaceAll("[.,;!?]+$", "");
            try {
                URI uri = URI.create(value);
                if (uri.getHost() != null) return value;
            } catch (IllegalArgumentException ignored) {}
        }
        return null;
    }

    public static boolean canFetch(String url) {
        return url != null && url.regionMatches(true, 0, "https://", 0, 8);
    }
}
