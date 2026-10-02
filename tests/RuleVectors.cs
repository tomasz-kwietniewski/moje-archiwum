using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

// Compiled together with native/Program.cs by tests/native-rules.mjs.
// Checks the Windows host against tests/vectors/rules.tsv, shared with src/core.js and Android.
internal static class RuleVectors
{
    private static string Unescape(string value)
    {
        return Regex.Replace(value, @"\\(u[0-9a-fA-F]{4}|.)", match =>
        {
            var code = match.Groups[1].Value;
            if (code.Length == 5 && code[0] == 'u') return ((char)Convert.ToInt32(code.Substring(1), 16)).ToString();
            return code == "t" ? "\t" : code == "n" ? "\n" : code;
        });
    }

    private static bool Throws(Action action)
    {
        try { action(); return false; } catch (Exception) { return true; }
    }

    private static int Main(string[] args)
    {
        var checkedCount = 0;
        foreach (var line in File.ReadAllLines(args.Length > 0 ? args[0] : "tests/vectors/rules.tsv", new UTF8Encoding(false)))
        {
            if (line.Length == 0 || line.StartsWith("#")) continue;
            var v = line.Split('\t').Select(Unescape).ToArray();
            bool ok;
            switch (v[0])
            {
                case "topic-ok": ok = !Throws(() => Program.ValidateTopic(v[1])); break;
                case "topic-bad": ok = Throws(() => Program.ValidateTopic(v[1])); break;
                case "fit": ok = Program.FitBasename(int.Parse(v[1]), v[2]) == v[3]; break;
                case "fit-bad": ok = Throws(() => Program.FitBasename(int.Parse(v[1]), v[2])); break;
                case "images":
                    ok = Program.FindImages(v[1]).Select(image => image.Url).SequenceEqual(v.Skip(2));
                    break;
                case "images-bad": ok = Throws(() => Program.FindImages(v[1])); break;
                case "title": case "date": continue; // The extension computes names before calling the host.
                default: ok = false; break;
            }
            if (!ok)
            {
                Console.Error.WriteLine("FAIL: " + line);
                return 1;
            }
            checkedCount++;
        }
        if (checkedCount < 30) { Console.Error.WriteLine("Too few vectors: " + checkedCount); return 1; }
        Console.WriteLine("PASS: Windows host rules match shared vectors (" + checkedCount + ").");
        return 0;
    }
}
