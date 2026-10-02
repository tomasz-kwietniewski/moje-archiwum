using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal static class Program
{
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
    private static readonly UTF8Encoding Utf8 = new UTF8Encoding(false, true);
    private static readonly string ConfigPath = Environment.GetEnvironmentVariable("MOJE_ARCHIWUM_CONFIG") ??
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MojeArchiwum", "folder.txt");
    private static readonly Regex Reserved = new Regex(@"^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)", RegexOptions.IgnoreCase);
    // Same whitespace set as JavaScript String.trim(); naming rules are shared through tests/vectors/rules.tsv.
    private static readonly Regex Edges = new Regex(@"^[\t\n\v\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+|[\t\n\v\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+$");
    // Windows MAX_PATH without NUL; the reserve covers "_10000" + "_assets\001.webp" (same as src/core.js).
    private const int MaxPath = 259;
    private const int PathReserve = 22;
    private const int MinBasename = 20;
    private const int MaxImages = 100;
    private const int MaxImageBytes = 15 * 1024 * 1024;
    private const int MaxTotalImageBytes = 100 * 1024 * 1024;

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            var input = Console.OpenStandardInput();
            var output = Console.OpenStandardOutput();
            var lengthBytes = ReadExactly(input, 4);
            if (lengthBytes == null) return 0;
            var length = BitConverter.ToInt32(lengthBytes, 0);
            if (length < 2 || length > 64 * 1024 * 1024) throw new InvalidDataException("Nieprawidłowy rozmiar wiadomości.");
            var bytes = ReadExactly(input, length);
            if (bytes == null) throw new EndOfStreamException("Niepełna wiadomość.");
            Dictionary<string, object> response;
            try
            {
                var request = Json.Deserialize<Dictionary<string, object>>(Utf8.GetString(bytes));
                response = Handle(request, args);
                response["ok"] = true;
            }
            catch (Exception error)
            {
                response = new Dictionary<string, object> { { "ok", false }, { "error", error.Message } };
                var missing = error as MissingImagesException;
                if (missing != null) response["missingImages"] = missing.Urls;
            }
            var answer = Utf8.GetBytes(Json.Serialize(response));
            if (answer.Length > 1024 * 1024) throw new InvalidDataException("Odpowiedź jest zbyt duża.");
            var answerLength = BitConverter.GetBytes(answer.Length);
            output.Write(answerLength, 0, 4);
            output.Write(answer, 0, answer.Length);
            output.Flush();
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error);
            return 1;
        }
    }

    private static byte[] ReadExactly(Stream stream, int count)
    {
        var buffer = new byte[count];
        var position = 0;
        while (position < count)
        {
            var read = stream.Read(buffer, position, count - position);
            if (read == 0) return null;
            position += read;
        }
        return buffer;
    }

    private static Dictionary<string, object> Handle(Dictionary<string, object> request, string[] args)
    {
        switch (Required(request, "op"))
        {
            case "status":
                return RootResult();
            case "choose":
                return Choose(args);
            case "topics":
                return new Dictionary<string, object> { { "topics", Directory.GetDirectories(RequireRoot())
                    .Select(Path.GetFileName).Where(name => !name.StartsWith(".") && name != "_resources")
                    .OrderBy(name => name, StringComparer.CurrentCultureIgnoreCase).ToArray() } };
            case "save":
                return Save(request);
            default:
                throw new InvalidDataException("Nieznana operacja.");
        }
    }

    private static Dictionary<string, object> RootResult()
    {
        var root = ReadRoot();
        return new Dictionary<string, object> { { "root", root }, { "name", root == null ? null : Path.GetFileName(root.TrimEnd(Path.DirectorySeparatorChar)) } };
    }

    private static string ReadRoot()
    {
        if (!File.Exists(ConfigPath)) return null;
        var root = File.ReadAllText(ConfigPath, Utf8).Trim();
        return Path.IsPathRooted(root) && Directory.Exists(root) ? Path.GetFullPath(root) : null;
    }

    private static string RequireRoot()
    {
        var root = ReadRoot();
        if (root == null) throw new DirectoryNotFoundException("Folder archiwum jest niedostępny. Wybierz go ponownie.");
        return root;
    }

    private static Dictionary<string, object> Choose(string[] args)
    {
        using (var dialog = new FolderBrowserDialog())
        {
            dialog.Description = "Wybierz folder archiwum notatek Markdown";
            dialog.ShowNewFolderButton = true;
            dialog.SelectedPath = ReadRoot() ?? Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            var parent = args.FirstOrDefault(arg => arg.StartsWith("--parent-window="));
            long value;
            var handle = parent != null && long.TryParse(parent.Substring("--parent-window=".Length), out value)
                ? new IntPtr(value) : IntPtr.Zero;
            var result = handle == IntPtr.Zero ? dialog.ShowDialog() : dialog.ShowDialog(new WindowOwner(handle));
            if (result != DialogResult.OK) return new Dictionary<string, object> { { "cancelled", true } };
            var root = Path.GetFullPath(dialog.SelectedPath);
            Directory.CreateDirectory(Path.GetDirectoryName(ConfigPath));
            File.WriteAllText(ConfigPath, root, Utf8);
            return RootResult();
        }
    }

    private static Dictionary<string, object> Save(Dictionary<string, object> request)
    {
        var root = RequireRoot();
        var topic = Required(request, "topic");
        var basename = Required(request, "basename");
        var content = Required(request, "content");
        object sourceValue, allowValue;
        var source = request.TryGetValue("source", out sourceValue) ? sourceValue as string : null;
        var allowMissing = request.TryGetValue("allowMissingImages", out allowValue) && allowValue is bool && (bool)allowValue;
        ValidateTopic(topic);
        ValidateName(basename, 180);
        if (content.Trim().Length == 0) throw new InvalidDataException("Notatka jest pusta.");
        var images = FindImages(content);
        if (images.Select(image => image.Url).Distinct(StringComparer.Ordinal).Count() > MaxImages)
            throw new InvalidDataException("Notatka ma więcej niż 100 obrazów.");
        var directory = Path.Combine(root, topic);
        basename = FitBasename(directory.Length, basename);
        Directory.CreateDirectory(directory);
        for (var n = 1; n <= 10000; n++)
        {
            var name = basename + (n == 1 ? "" : "_" + n) + ".md";
            var path = Path.Combine(directory, name);
            var assetName = Path.GetFileNameWithoutExtension(name) + "_assets";
            var assetDirectory = Path.Combine(directory, assetName);
            if (File.Exists(path) || (images.Count > 0 && Directory.Exists(assetDirectory))) continue;
            var createdAssets = false;
            var createdNote = false;
            FileStream file;
            try
            {
                var rewritten = content;
                var missing = new List<string>();
                if (images.Count > 0)
                {
                    Directory.CreateDirectory(assetDirectory);
                    createdAssets = true;
                    var paths = new Dictionary<string, string>(StringComparer.Ordinal);
                    var totalBytes = 0;
                    foreach (var image in images)
                    {
                        if (paths.ContainsKey(image.Url) || missing.Contains(image.Url)) continue;
                        ImageData data;
                        try { data = DownloadImage(image.Url, source, MaxTotalImageBytes - totalBytes); }
                        catch (Exception) { missing.Add(image.Url); continue; }
                        totalBytes += data.Bytes.Length;
                        var imageName = (paths.Count + 1).ToString("D3") + "." + data.Extension;
                        using (var asset = new FileStream(Path.Combine(assetDirectory, imageName), FileMode.CreateNew, FileAccess.Write, FileShare.None))
                            asset.Write(data.Bytes, 0, data.Bytes.Length);
                        paths.Add(image.Url, Uri.EscapeDataString(assetName) + "/" + imageName);
                    }
                    if (missing.Count > 0 && !allowMissing)
                        throw new MissingImagesException(missing, images.Select(image => image.Url).Distinct(StringComparer.Ordinal).Count());
                    if (paths.Count == 0) { Directory.Delete(assetDirectory, true); createdAssets = false; }
                    var builder = new StringBuilder(content);
                    for (var i = images.Count - 1; i >= 0; i--)
                    {
                        var image = images[i];
                        string local;
                        // An image the user agreed to skip keeps its internet address.
                        if (!paths.TryGetValue(image.Url, out local)) continue;
                        builder.Remove(image.Start, image.End - image.Start);
                        builder.Insert(image.Start, local);
                    }
                    rewritten = builder.ToString();
                }
                file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
                createdNote = true;
                using (file)
                using (var writer = new StreamWriter(file, Utf8)) writer.Write(rewritten);
                return new Dictionary<string, object> { { "name", name }, { "path", Path.Combine(topic, name) }, { "root", root }, { "missingImages", missing.ToArray() } };
            }
            catch (IOException)
            {
                if (createdNote) File.Delete(path);
                if (createdAssets) Directory.Delete(assetDirectory, true);
                if (!createdNote && File.Exists(path)) continue;
                throw;
            }
            catch
            {
                if (createdNote) File.Delete(path);
                if (createdAssets) Directory.Delete(assetDirectory, true);
                throw;
            }
        }
        throw new IOException("Zbyt wiele notatek o tej nazwie. Zmień tytuł.");
    }

    private sealed class MissingImagesException : Exception
    {
        public MissingImagesException(List<string> urls, int total)
            : base("Nie udało się pobrać " + urls.Count + " z " + total + " obrazów, np. " + urls[0])
        { Urls = urls.ToArray(); }
        public string[] Urls { get; private set; }
    }

    internal sealed class ImageReference
    {
        public int Start;
        public int End;
        public string Url;
    }

    internal static List<ImageReference> FindImages(string markdown)
    {
        var result = new List<ImageReference>();
        for (var i = 0; i + 3 < markdown.Length; i++)
        {
            if (markdown[i] != '!' || markdown[i + 1] != '[' || Escaped(markdown, i)) continue;
            var bracket = ClosingBracket(markdown, i + 1);
            if (bracket < 0 || bracket + 1 >= markdown.Length || markdown[bracket + 1] != '(') continue;
            var start = bracket + 2;
            var depth = 1;
            var close = -1;
            for (var j = start; j < markdown.Length; j++)
            {
                if (Escaped(markdown, j)) continue;
                if (markdown[j] == '(') depth++;
                else if (markdown[j] == ')' && --depth == 0) { close = j; break; }
            }
            if (close < 0) continue;
            var end = close;
            while (start < end && Char.IsWhiteSpace(markdown[start])) start++;
            while (end > start && Char.IsWhiteSpace(markdown[end - 1])) end--;
            for (var j = start; j < end - 2; j++)
            {
                if (!Char.IsWhiteSpace(markdown[j])) continue;
                var quoteAt = j;
                while (quoteAt < end && Char.IsWhiteSpace(markdown[quoteAt])) quoteAt++;
                if (quoteAt < end && (markdown[quoteAt] == '"' || markdown[quoteAt] == '\'') && markdown[end - 1] == markdown[quoteAt])
                { end = j; break; }
            }
            if (start < end && markdown[start] == '<' && markdown[end - 1] == '>') { start++; end--; }
            var url = UnescapeDestination(markdown.Substring(start, end - start));
            if (url.StartsWith("//", StringComparison.Ordinal)) throw new InvalidDataException("Obraz ma adres bez protokołu: " + url);
            Uri parsed;
            if (Uri.TryCreate(url, UriKind.Absolute, out parsed) && (parsed.Scheme == "http" || parsed.Scheme == "https"))
                result.Add(new ImageReference { Start = start, End = end, Url = url });
            i = close;
        }
        return result;
    }

    // CommonMark backslash escapes: Turndown writes format(webp) as format\(webp\), the server needs the plain address.
    private static string UnescapeDestination(string destination)
    {
        var builder = new StringBuilder(destination.Length);
        for (var i = 0; i < destination.Length; i++)
        {
            if (destination[i] == '\\' && i + 1 < destination.Length && IsAsciiPunctuation(destination[i + 1])) i++;
            builder.Append(destination[i]);
        }
        return builder.ToString();
    }

    private static bool IsAsciiPunctuation(char c)
    {
        return (c >= '!' && c <= '/') || (c >= ':' && c <= '@') || (c >= '[' && c <= '`') || (c >= '{' && c <= '~');
    }

    private static int ClosingBracket(string text, int open)
    {
        var depth = 1;
        for (var i = open + 1; i < text.Length; i++)
        {
            if (Escaped(text, i)) continue;
            if (text[i] == '[') depth++;
            else if (text[i] == ']' && --depth == 0) return i;
        }
        return -1;
    }

    private static bool Escaped(string text, int at)
    {
        var slashes = 0;
        for (var i = at - 1; i >= 0 && text[i] == '\\'; i--) slashes++;
        return (slashes & 1) != 0;
    }

    private sealed class ImageData
    {
        public byte[] Bytes;
        public string Extension;
    }

    private static ImageData DownloadImage(string address, string source, int remaining)
    {
        var uri = new Uri(address);
        if (uri.Scheme != "http" && uri.Scheme != "https") throw new InvalidDataException("Nieprawidłowy adres obrazu.");
        ServicePointManager.SecurityProtocol |= (SecurityProtocolType)3072;
        var request = (HttpWebRequest)WebRequest.Create(uri);
        request.Timeout = 15000;
        request.ReadWriteTimeout = 30000;
        request.UserAgent = "Mozilla/5.0 MojeArchiwum/0.4";
        request.Accept = "image/*";
        Uri referer;
        if (Uri.TryCreate(source, UriKind.Absolute, out referer) && (referer.Scheme == "http" || referer.Scheme == "https"))
            request.Referer = referer.AbsoluteUri;
        using (var response = (HttpWebResponse)request.GetResponse())
        {
            var mime = response.ContentType.Split(';')[0].Trim().ToLowerInvariant();
            string extension;
            switch (mime)
            {
                case "image/jpeg":
                case "image/jpg": extension = "jpg"; break;
                case "image/png": extension = "png"; break;
                case "image/gif": extension = "gif"; break;
                case "image/webp": extension = "webp"; break;
                case "image/avif": extension = "avif"; break;
                case "image/bmp": extension = "bmp"; break;
                case "image/svg+xml": extension = "svg"; break;
                default: throw new InvalidDataException("Nieobsługiwany typ obrazu " + mime + ": " + address);
            }
            var limit = Math.Min(MaxImageBytes, remaining);
            if (limit <= 0 || response.ContentLength > limit) throw new InvalidDataException("Obrazy przekraczają limit rozmiaru.");
            using (var input = response.GetResponseStream())
            using (var bytes = new MemoryStream())
            {
                var chunk = new byte[8192];
                int read;
                while ((read = input.Read(chunk, 0, chunk.Length)) > 0)
                {
                    if (bytes.Length + read > limit) throw new InvalidDataException("Obraz przekracza limit rozmiaru: " + address);
                    bytes.Write(chunk, 0, read);
                }
                if (bytes.Length == 0) throw new InvalidDataException("Pusty obraz: " + address);
                return new ImageData { Bytes = bytes.ToArray(), Extension = extension };
            }
        }
    }

    internal static void ValidateTopic(string topic)
    {
        if (Edges.IsMatch(topic) || topic == "_resources" || topic.StartsWith(".")) throw new InvalidDataException("Niedozwolona nazwa tematu.");
        ValidateName(topic, 100);
    }

    internal static string FitBasename(int directoryLength, string basename)
    {
        var max = MaxPath - (directoryLength + 1) - PathReserve;
        if (max < MinBasename) throw new PathTooLongException("Ścieżka folderu tematu jest zbyt długa.");
        if (basename.Length <= max) return basename;
        var cut = basename.Substring(0, max);
        if (Char.IsHighSurrogate(cut[cut.Length - 1])) cut = cut.Substring(0, cut.Length - 1);
        return cut.TrimEnd('.', ' ');
    }

    private static void ValidateName(string name, int maxLength)
    {
        if (String.IsNullOrWhiteSpace(name) || name != name.Trim() || name.Length > maxLength ||
            name.EndsWith(".") || name.EndsWith(" ") || name.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 ||
            Reserved.IsMatch(name)) throw new InvalidDataException("Nieprawidłowa nazwa folderu lub pliku.");
    }

    private static string Required(Dictionary<string, object> request, string key)
    {
        object value;
        if (request == null || !request.TryGetValue(key, out value) || !(value is string))
            throw new InvalidDataException("Brak pola: " + key);
        return (string)value;
    }

    private sealed class WindowOwner : IWin32Window
    {
        public WindowOwner(IntPtr handle) { Handle = handle; }
        public IntPtr Handle { get; private set; }
    }
}
