package pl.tomaszkwietniewski.moje_archiwum;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.DocumentsContract;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Filter;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public final class MainActivity extends Activity {
    private static final int PICK_FOLDER = 24;
    private static final String PREFS = "archive";
    private static final String FOLDER_KEY = "folderUri";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private EditText source;
    private EditText title;
    private AutoCompleteTextView topic;
    private EditText body;
    private TextView folderLabel;
    private TextView status;
    private Button saveButton;
    private Button fullPageButton;
    private WebView page;
    private Uri folderUri;
    private String fullPage = "";
    private String captureScript;
    private int loadVersion = 0;
    private boolean loadFailed = false;
    private boolean saveAfterFolderChoice = false;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_main);
        source = findViewById(R.id.source);
        title = findViewById(R.id.title);
        topic = findViewById(R.id.topic);
        body = findViewById(R.id.body);
        folderLabel = findViewById(R.id.folderLabel);
        status = findViewById(R.id.status);
        saveButton = findViewById(R.id.save);
        fullPageButton = findViewById(R.id.fullPage);
        topic.setText(getPreferences(MODE_PRIVATE).getString("topic", "Do uporządkowania"));
        String savedFolder = getSharedPreferences(PREFS, MODE_PRIVATE).getString(FOLDER_KEY, null);
        if (savedFolder != null) folderUri = Uri.parse(savedFolder);
        updateFolderLabel();
        loadTopics();

        // Closing returns to the app that shared the article (usually Brave).
        findViewById(R.id.close).setOnClickListener(view -> finish());
        findViewById(R.id.chooseFolder).setOnClickListener(view -> chooseFolder());
        findViewById(R.id.fetch).setOnClickListener(view -> fetchArticle());
        saveButton.setOnClickListener(view -> saveNote());
        fullPageButton.setOnClickListener(view -> {
            body.setText(fullPage);
            showStatus("Wstawiono całą stronę. Sprawdź treść przed zapisem.");
        });

        page = new WebView(this);
        page.setAlpha(0f);
        page.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        ((LinearLayout) findViewById(R.id.root)).addView(page,
                new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1));
        page.getSettings().setJavaScriptEnabled(true);
        page.getSettings().setDomStorageEnabled(true);
        page.getSettings().setAllowFileAccess(false);
        page.getSettings().setAllowContentAccess(false);
        page.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        page.getSettings().setSafeBrowsingEnabled(true);
        page.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!"https".equalsIgnoreCase(request.getUrl().getScheme())) {
                    loadFailed = true;
                    showStatus("Strona przekierowała poza HTTPS. Możesz wkleić treść ręcznie.");
                    return true;
                }
                return false;
            }
            @Override public void onPageStarted(WebView view, String url, Bitmap icon) {
                showStatus("Odczytuję stronę...");
            }
            @Override public void onPageFinished(WebView view, String url) {
                int version = loadVersion;
                if (ShareInput.canFetch(url) && !loadFailed) handler.postDelayed(() -> {
                    if (version == loadVersion && !loadFailed && url.equals(view.getUrl())) extractArticle();
                }, 800);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    loadFailed = true;
                    showStatus("Nie udało się otworzyć strony. Możesz wkleić treść ręcznie.");
                }
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) {
                    loadFailed = true;
                    showStatus("Strona zwróciła błąd HTTP " + response.getStatusCode() + ". Możesz wkleić treść ręcznie.");
                }
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, android.net.http.SslError error) {
                handler.cancel();
                loadFailed = true;
                showStatus("Nieprawidłowy certyfikat strony. Nie pobrano treści.");
            }
        });
        if (state == null) handleShare(getIntent());
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleShare(intent);
    }

    private void handleShare(Intent intent) {
        if (!Intent.ACTION_SEND.equals(intent.getAction()) || !"text/plain".equals(intent.getType())) return;
        String shared = intent.getStringExtra(Intent.EXTRA_TEXT);
        String url = ShareInput.firstUrl(shared);
        if (url == null) { showStatus("Nie znaleziono adresu strony. Wklej adres lub treść ręcznie."); return; }
        source.setText(url);
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        title.setText(subject == null ? "" : subject);
        body.setText("");
        fetchArticle();
    }

    private void fetchArticle() {
        String url = ShareInput.firstUrl(source.getText().toString());
        if (url == null) { showStatus("Podaj poprawny adres strony."); return; }
        source.setText(url);
        if (!ShareInput.canFetch(url)) {
            showStatus("Automatyczne pobieranie działa dla HTTPS. Treść można wkleić ręcznie.");
            return;
        }
        loadVersion++;
        int version = loadVersion;
        loadFailed = false;
        fullPage = "";
        fullPageButton.setVisibility(View.GONE);
        showStatus("Odczytuję stronę...");
        page.loadUrl(url);
        handler.postDelayed(() -> {
            if (version == loadVersion && body.getText().toString().trim().isEmpty())
                showStatus("Odczyt trwa długo. Możesz wkleić treść ręcznie.");
        }, 25000);
    }

    private void extractArticle() {
        try {
            if (captureScript == null) captureScript = readAsset("capture.js");
            String script = captureScript + "\n;(() => { try { return JSON.stringify(globalThis.__captureMarkdownPage()); } " +
                    "catch (error) { return JSON.stringify({error: String(error.message || error)}); } })()";
            page.evaluateJavascript(script, result -> {
                try {
                    String json = new JSONArray("[" + result + "]").getString(0);
                    JSONObject capture = new JSONObject(json);
                    if (capture.has("error")) throw new IllegalArgumentException(capture.getString("error"));
                    source.setText(capture.getString("url"));
                    title.setText(capture.getString("title"));
                    body.setText(capture.getString("body"));
                    fullPage = capture.optString("full", "");
                    fullPageButton.setVisibility(fullPage.isEmpty() ? View.GONE : View.VISIBLE);
                    showStatus("Artykuł gotowy. Sprawdź treść i zapisz notatkę.");
                } catch (Exception error) {
                    showStatus("Nie udało się wyodrębnić artykułu. Możesz wkleić treść ręcznie.");
                }
            });
        } catch (Exception error) {
            showStatus("Brakuje kodu wyodrębniania artykułu w aplikacji.");
        }
    }

    private String readAsset(String name) throws Exception {
        try (InputStream input = getAssets().open(name); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private void chooseFolder() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(intent, PICK_FOLDER);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_FOLDER) return;
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            saveAfterFolderChoice = false;
            showStatus("Nie wybrano folderu.");
            return;
        }
        try {
            Uri selected = data.getData();
            int flags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            getContentResolver().takePersistableUriPermission(selected, flags);
            folderUri = selected;
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(FOLDER_KEY, selected.toString()).apply();
            updateFolderLabel();
            loadTopics();
            showStatus("Folder wybrany. Notatki będą zapisywane lokalnie.");
            if (saveAfterFolderChoice) { saveAfterFolderChoice = false; saveNote(); }
        } catch (Exception error) {
            saveAfterFolderChoice = false;
            showStatus("Nie udało się uzyskać dostępu do folderu: " + error.getMessage());
        }
    }

    private void updateFolderLabel() {
        if (folderUri == null) { folderLabel.setText("Wybierz miejsce na notatki"); return; }
        try {
            Uri root = DocumentsContract.buildDocumentUriUsingTree(folderUri, DocumentsContract.getTreeDocumentId(folderUri));
            try (android.database.Cursor cursor = getContentResolver().query(root,
                    new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null)) {
                folderLabel.setText(cursor != null && cursor.moveToFirst() ? cursor.getString(0) : folderUri.getLastPathSegment());
            }
        } catch (Exception error) { folderLabel.setText("Folder wybrany. Jeśli zapis się nie uda, wybierz go ponownie."); }
    }

    // The phone has only the inbox, not the archive; the PC writes the topic names into it (TopicList.FILE).
    private void loadTopics() {
        Uri tree = folderUri;
        if (tree == null) return;
        new Thread(() -> {
            List<String> topics = new ArchiveStore(getContentResolver()).topics(tree);
            runOnUiThread(() -> { if (!isFinishing()) topic.setAdapter(new TopicAdapter(topics)); });
        }).start();
    }

    /** Suggests topics containing the typed text, ignoring case and Polish letters ("kosz" -> "Koszykówka"). */
    private final class TopicAdapter extends ArrayAdapter<String> {
        private final List<String> all;

        TopicAdapter(List<String> all) {
            super(MainActivity.this, android.R.layout.simple_dropdown_item_1line, new ArrayList<>(all));
            this.all = all;
        }

        @Override public Filter getFilter() {
            return new Filter() {
                @Override protected FilterResults performFiltering(CharSequence query) {
                    List<String> matches = TopicList.matching(all, query == null ? "" : query.toString());
                    FilterResults results = new FilterResults();
                    results.values = matches;
                    results.count = matches.size();
                    return results;
                }

                @SuppressWarnings("unchecked")
                @Override protected void publishResults(CharSequence query, FilterResults results) {
                    clear();
                    if (results.values != null) addAll((List<String>) results.values);
                    notifyDataSetChanged();
                }
            };
        }
    }

    private void saveNote() { saveNote(false); }

    private void saveNote(boolean allowMissingImages) {
        String noteTitle = title.getText().toString();
        String noteTopic = topic.getText().toString();
        String noteSource = source.getText().toString();
        String noteBody = body.getText().toString();
        Instant now = Instant.now();
        try {
            NoteFormat.validTopic(noteTopic);
            NoteFormat.markdown(noteTitle, noteSource, noteBody, now);
        } catch (IllegalArgumentException error) { showStatus(error.getMessage()); return; }
        if (folderUri == null) { saveAfterFolderChoice = true; chooseFolder(); return; }
        Uri destination = folderUri;
        saveButton.setEnabled(false);
        showStatus("Zapisuję notatkę...");
        new Thread(() -> {
            try {
                ArchiveStore.Saved saved = new ArchiveStore(getContentResolver())
                        .save(destination, noteTopic, noteTitle, noteSource, noteBody, now, allowMissingImages);
                getPreferences(MODE_PRIVATE).edit().putString("topic", noteTopic).apply();
                String skipped = saved.missingImages.isEmpty() ? ""
                        : ". Obrazy niepobrane (" + saved.missingImages.size() + ") zostały linkami internetowymi.";
                runOnUiThread(() -> {
                    // After a successful save go straight back to reading; errors keep the window open.
                    Toast.makeText(getApplicationContext(), "Zapisano w „" + noteTopic + "”" + skipped, Toast.LENGTH_LONG).show();
                    finish();
                });
            } catch (ArchiveStore.MissingImagesException error) {
                runOnUiThread(() -> {
                    saveButton.setEnabled(true);
                    showStatus("Nie zapisano notatki: " + error.getMessage());
                    new AlertDialog.Builder(this)
                            .setTitle("Brakujące obrazy")
                            .setMessage(error.getMessage() + ".\n\nZapisać notatkę bez nich? Zostaną linkami internetowymi.")
                            .setPositiveButton("Zapisz bez nich", (dialog, which) -> saveNote(true))
                            .setNegativeButton("Anuluj", null)
                            .show();
                });
            } catch (Exception error) {
                runOnUiThread(() -> { saveButton.setEnabled(true); showStatus("Nie zapisano notatki: " + error.getMessage()); });
            }
        }).start();
    }

    private void showStatus(String message) { status.setText(message); }

    @Override protected void onDestroy() {
        loadVersion++;
        if (page != null) page.destroy();
        super.onDestroy();
    }
}
