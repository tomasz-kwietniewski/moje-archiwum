package pl.tomaszkwietniewski.moje_archiwum;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class ImageLinks {
    public static final class Reference {
        public final int start;
        public final int end;
        public final String url;

        Reference(int start, int end, String url) {
            this.start = start;
            this.end = end;
            this.url = url;
        }
    }

    private ImageLinks() {}

    public static List<Reference> find(String markdown) {
        List<Reference> result = new ArrayList<>();
        for (int i = 0; i + 3 < markdown.length(); i++) {
            if (markdown.charAt(i) != '!' || markdown.charAt(i + 1) != '[' || escaped(markdown, i)) continue;
            int closeBracket = closingBracket(markdown, i + 1);
            if (closeBracket < 0 || closeBracket + 1 >= markdown.length()
                    || markdown.charAt(closeBracket + 1) != '(') continue;
            int start = closeBracket + 2;
            int depth = 1;
            int closeParen = -1;
            for (int j = start; j < markdown.length(); j++) {
                if (escaped(markdown, j)) continue;
                char c = markdown.charAt(j);
                if (c == '(') depth++;
                else if (c == ')' && --depth == 0) { closeParen = j; break; }
            }
            if (closeParen < 0) continue;
            int end = closeParen;
            while (start < end && Character.isWhitespace(markdown.charAt(start))) start++;
            while (end > start && Character.isWhitespace(markdown.charAt(end - 1))) end--;
            for (int j = start; j < end - 2; j++) {
                if (!Character.isWhitespace(markdown.charAt(j))) continue;
                int quoteAt = j;
                while (quoteAt < end && Character.isWhitespace(markdown.charAt(quoteAt))) quoteAt++;
                char quote = quoteAt < end ? markdown.charAt(quoteAt) : 0;
                if ((quote == '"' || quote == '\'') && markdown.charAt(end - 1) == quote) {
                    end = j;
                    break;
                }
            }
            if (start < end && markdown.charAt(start) == '<' && markdown.charAt(end - 1) == '>') {
                start++;
                end--;
            }
            String url = unescapeDestination(markdown.substring(start, end));
            if (url.startsWith("//")) throw new IllegalArgumentException("Obraz ma adres bez protokołu: " + url);
            if (url.regionMatches(true, 0, "http://", 0, 7)
                    || url.regionMatches(true, 0, "https://", 0, 8)) result.add(new Reference(start, end, url));
            i = closeParen;
        }
        return result;
    }

    // CommonMark backslash escapes: Turndown writes format(webp) as format\(webp\), the server needs the plain address.
    private static String unescapeDestination(String destination) {
        StringBuilder builder = new StringBuilder(destination.length());
        for (int i = 0; i < destination.length(); i++) {
            if (destination.charAt(i) == '\\' && i + 1 < destination.length()
                    && isAsciiPunctuation(destination.charAt(i + 1))) i++;
            builder.append(destination.charAt(i));
        }
        return builder.toString();
    }

    private static boolean isAsciiPunctuation(char c) {
        return (c >= '!' && c <= '/') || (c >= ':' && c <= '@') || (c >= '[' && c <= '`') || (c >= '{' && c <= '~');
    }

    private static int closingBracket(String text, int open) {
        int depth = 1;
        for (int i = open + 1; i < text.length(); i++) {
            if (escaped(text, i)) continue;
            if (text.charAt(i) == '[') depth++;
            else if (text.charAt(i) == ']' && --depth == 0) return i;
        }
        return -1;
    }

    private static boolean escaped(String text, int at) {
        int slashes = 0;
        for (int i = at - 1; i >= 0 && text.charAt(i) == '\\'; i--) slashes++;
        return (slashes & 1) != 0;
    }

    /** Android blocks cleartext HTTP, so an http image is retried like a browser upgrading mixed content. */
    public static String httpsVariant(String url) {
        return url.regionMatches(true, 0, "http://", 0, 7) ? "https://" + url.substring(7) : null;
    }

    public static String rewrite(String markdown, List<Reference> references, Map<String, String> localPaths) {
        StringBuilder result = new StringBuilder(markdown);
        for (int i = references.size() - 1; i >= 0; i--) {
            Reference ref = references.get(i);
            if (!unescapeDestination(markdown.substring(ref.start, ref.end)).equals(ref.url))
                throw new IllegalArgumentException("Nieprawidłowy adres obrazu w notatce.");
            String local = localPaths.get(ref.url);
            // An image the user agreed to skip keeps its internet address.
            if (local != null) result.replace(ref.start, ref.end, local);
        }
        return result.toString();
    }
}
