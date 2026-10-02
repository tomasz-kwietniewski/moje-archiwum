package pl.tomaszkwietniewski.moje_archiwum;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Archive topics for the phone. The phone syncs only the inbox, so scripts/telefon-skrzynka.mjs on the PC
 * writes the topic names into "_tematy.txt" there; the topic field suggests from that list.
 */
public final class TopicList {
    public static final String FILE = "_tematy.txt";

    private TopicList() {}

    public static List<String> parse(String text) {
        Set<String> result = new LinkedHashSet<>();
        for (String line : text.replace("﻿", "").split("\r?\n")) {
            String name = line.trim();
            try { result.add(NoteFormat.validTopic(name)); } catch (IllegalArgumentException invalid) { /* skip */ }
        }
        return new ArrayList<>(result);
    }

    /** Topics containing the query, ignoring case and Polish letters; names starting with it come first. */
    public static List<String> matching(List<String> topics, String query) {
        String wanted = fold(query.trim());
        if (wanted.isEmpty()) return new ArrayList<>(topics);
        List<String> starts = new ArrayList<>(), contains = new ArrayList<>();
        for (String topic : topics) {
            String folded = fold(topic);
            if (folded.startsWith(wanted)) starts.add(topic);
            else if (folded.contains(wanted)) contains.add(topic);
        }
        starts.addAll(contains);
        return starts;
    }

    static String fold(String value) {
        String lower = value.toLowerCase(Locale.ROOT).replace('ł', 'l');
        return Normalizer.normalize(lower, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    }
}
