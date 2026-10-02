package pl.tomaszkwietniewski.moje_archiwum;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class ArchiveStore {
    private static final String DIRECTORY = DocumentsContract.Document.MIME_TYPE_DIR;
    private static final int MAX_IMAGES = 100;
    private static final int MAX_IMAGE_BYTES = 15 * 1024 * 1024;
    private static final int MAX_TOTAL_BYTES = 100 * 1024 * 1024;
    private final ContentResolver resolver;

    /** Thrown when some images could not be downloaded and the user has not agreed to skip them. */
    public static final class MissingImagesException extends IOException {
        public final List<String> urls;
        MissingImagesException(List<String> urls, int total) {
            super("Nie udało się pobrać " + urls.size() + " z " + total + " obrazów, np. " + urls.get(0));
            this.urls = urls;
        }
    }

    public static final class Saved {
        public final String path;
        public final List<String> missingImages;
        Saved(String path, List<String> missingImages) { this.path = path; this.missingImages = missingImages; }
    }

    public ArchiveStore(ContentResolver resolver) { this.resolver = resolver; }

    public Saved save(Uri tree, String topic, String title, String source, String body, Instant date,
                      boolean allowMissingImages) throws IOException {
        NoteFormat.validTopic(topic);
        NoteFormat.markdown(title, source, body, date);
        List<ImageLinks.Reference> images = ImageLinks.find(body);
        Set<String> urls = new java.util.LinkedHashSet<>();
        for (ImageLinks.Reference image : images) urls.add(image.url);
        if (urls.size() > MAX_IMAGES) throw new IOException("Notatka ma więcej niż 100 obrazów.");
        Uri root = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
        Uri topicUri = findFolder(tree, root, topic);
        if (topicUri == null) {
            topicUri = DocumentsContract.createDocument(resolver, root, DIRECTORY, topic);
            if (topicUri == null) throw new IOException("Nie udało się utworzyć folderu tematu.");
        }

        Set<String> existing = names(tree, topicUri);
        String chosen = NoteFormat.uniqueFilename(title, date, existing);
        String assetName = chosen.substring(0, chosen.length() - 3) + "_assets";
        while (containsIgnoreCase(existing, assetName)) {
            existing.add(chosen);
            chosen = NoteFormat.uniqueFilename(title, date, existing);
            assetName = chosen.substring(0, chosen.length() - 3) + "_assets";
        }
        Uri assetFolder = null;
        Uri file = null;
        List<String> missing = new ArrayList<>();
        try {
            String localBody = body;
            if (!urls.isEmpty()) {
                assetFolder = DocumentsContract.createDocument(resolver, topicUri, DIRECTORY, assetName);
                if (assetFolder == null) throw new IOException("Nie udało się utworzyć folderu obrazów.");
                String actualAssetName = displayName(assetFolder, assetName);
                Map<String, String> localPaths = new LinkedHashMap<>();
                int totalBytes = 0;
                for (String url : urls) {
                    DownloadedImage image;
                    try { image = downloadWithHttpsUpgrade(url, source, MAX_TOTAL_BYTES - totalBytes); }
                    catch (IOException error) { missing.add(url); continue; }
                    totalBytes += image.bytes.length;
                    String filename = String.format(java.util.Locale.ROOT, "%03d.%s", localPaths.size() + 1, image.extension);
                    Uri imageFile = DocumentsContract.createDocument(resolver, assetFolder, image.mime, filename);
                    if (imageFile == null) throw new IOException("Nie udało się utworzyć pliku obrazu.");
                    try (OutputStream output = resolver.openOutputStream(imageFile, "w")) {
                        if (output == null) throw new IOException("Nie udało się zapisać obrazu.");
                        output.write(image.bytes);
                    }
                    localPaths.put(url, Uri.encode(actualAssetName) + "/" + Uri.encode(displayName(imageFile, filename)));
                }
                if (!missing.isEmpty() && !allowMissingImages) throw new MissingImagesException(missing, urls.size());
                if (localPaths.isEmpty()) { DocumentsContract.deleteDocument(resolver, assetFolder); assetFolder = null; }
                localBody = ImageLinks.rewrite(body, images, localPaths);
            }
            String markdown = NoteFormat.markdown(title, source, localBody, date);
            file = DocumentsContract.createDocument(resolver, topicUri, "text/markdown", chosen);
            if (file == null) throw new IOException("Nie udało się utworzyć pliku notatki.");
            try (OutputStream output = resolver.openOutputStream(file, "w")) {
                if (output == null) throw new IOException("Nie udało się otworzyć pliku do zapisu.");
                output.write(markdown.getBytes(StandardCharsets.UTF_8));
            }
        } catch (IOException | RuntimeException error) {
            if (file != null) try { DocumentsContract.deleteDocument(resolver, file); }
            catch (Exception cleanupError) { error.addSuppressed(cleanupError); }
            if (assetFolder != null) try { DocumentsContract.deleteDocument(resolver, assetFolder); }
            catch (Exception cleanupError) { error.addSuppressed(cleanupError); }
            throw error;
        }
        return new Saved(topic + "/" + displayName(file, chosen), missing);
    }

    private static boolean containsIgnoreCase(Set<String> names, String wanted) {
        for (String name : names) if (name.equalsIgnoreCase(wanted)) return true;
        return false;
    }

    private static final class DownloadedImage {
        final byte[] bytes;
        final String mime;
        final String extension;
        DownloadedImage(byte[] bytes, String mime, String extension) {
            this.bytes = bytes;
            this.mime = mime;
            this.extension = extension;
        }
    }

    private static DownloadedImage downloadWithHttpsUpgrade(String address, String source, int remaining) throws IOException {
        String secure = ImageLinks.httpsVariant(address);
        return downloadImage(secure != null ? secure : address, source, remaining);
    }

    private static DownloadedImage downloadImage(String address, String source, int remaining) throws IOException {
        URL url = new URL(address);
        if (!"https".equalsIgnoreCase(url.getProtocol()))
            throw new IOException("Obraz nie używa HTTPS: " + address);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(30000);
        connection.setRequestProperty("User-Agent", "Mozilla/5.0 MojeArchiwum/0.3");
        connection.setRequestProperty("Accept", "image/*");
        if (source != null && source.startsWith("https://")) connection.setRequestProperty("Referer", source);
        try {
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IOException("Obraz zwrócił HTTP " + status + ": " + address);
            if (!"https".equalsIgnoreCase(connection.getURL().getProtocol()))
                throw new IOException("Obraz przekierował poza HTTPS: " + address);
            String mime = connection.getContentType();
            if (mime == null) throw new IOException("Serwer nie podał typu obrazu: " + address);
            mime = mime.split(";", 2)[0].trim().toLowerCase(java.util.Locale.ROOT);
            String extension;
            switch (mime) {
                case "image/jpg": mime = "image/jpeg";
                case "image/jpeg": extension = "jpg"; break;
                case "image/png": extension = "png"; break;
                case "image/gif": extension = "gif"; break;
                case "image/webp": extension = "webp"; break;
                case "image/avif": extension = "avif"; break;
                case "image/bmp": extension = "bmp"; break;
                case "image/svg+xml": extension = "svg"; break;
                default: throw new IOException("Nieobsługiwany typ obrazu " + mime + ": " + address);
            }
            int limit = Math.min(MAX_IMAGE_BYTES, remaining);
            if (limit <= 0 || connection.getContentLengthLong() > limit)
                throw new IOException("Obrazy przekraczają limit rozmiaru.");
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (InputStream input = connection.getInputStream()) {
                byte[] chunk = new byte[8192];
                int read;
                while ((read = input.read(chunk)) != -1) {
                    if (bytes.size() + read > limit) throw new IOException("Obraz przekracza limit rozmiaru: " + address);
                    bytes.write(chunk, 0, read);
                }
            }
            if (bytes.size() == 0) throw new IOException("Pusty obraz: " + address);
            return new DownloadedImage(bytes.toByteArray(), mime, extension);
        } finally { connection.disconnect(); }
    }

    private Uri findFolder(Uri tree, Uri parent, String wanted) throws IOException {
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(parent));
        try (Cursor cursor = resolver.query(children, new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE}, null, null, null)) {
            if (cursor == null) throw new IOException("Nie można odczytać wybranego folderu.");
            while (cursor.moveToNext()) if (wanted.equalsIgnoreCase(cursor.getString(1))) {
                if (!DIRECTORY.equals(cursor.getString(2))) throw new IOException("Nazwa tematu jest zajęta przez plik.");
                return DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(0));
            }
        }
        return null;
    }

    private Set<String> names(Uri tree, Uri parent) throws IOException {
        Set<String> result = new HashSet<>();
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(parent));
        try (Cursor cursor = resolver.query(children, new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null)) {
            if (cursor == null) throw new IOException("Nie można sprawdzić istniejących notatek.");
            while (cursor.moveToNext()) result.add(cursor.getString(0));
        }
        return result;
    }

    /** Topics from "_tematy.txt" in the chosen folder; empty until the PC has written it and it has synced. */
    public List<String> topics(Uri tree) {
        try {
            Uri root = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
            Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(root));
            try (Cursor cursor = resolver.query(children, new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                    DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null)) {
                while (cursor != null && cursor.moveToNext()) {
                    if (!TopicList.FILE.equals(cursor.getString(1))) continue;
                    Uri file = DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(0));
                    try (InputStream input = resolver.openInputStream(file); ByteArrayOutputStream text = new ByteArrayOutputStream()) {
                        if (input == null) break;
                        byte[] chunk = new byte[8192];
                        int read;
                        while ((read = input.read(chunk)) != -1) text.write(chunk, 0, read);
                        return TopicList.parse(text.toString(StandardCharsets.UTF_8.name()));
                    }
                }
            }
        } catch (IOException | RuntimeException unreadable) { /* the field still accepts any topic */ }
        return new ArrayList<>();
    }

    private String displayName(Uri file, String fallback) {
        try (Cursor cursor = resolver.query(file, new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null)) {
            return cursor != null && cursor.moveToFirst() ? cursor.getString(0) : fallback;
        } catch (RuntimeException ignored) { return fallback; }
    }
}
