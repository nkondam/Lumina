package app;

import dev.lumina.runtime.DevServer;
import com.google.gson.Gson;
import java.sql.*;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.BiConsumer;
import java.util.function.Function;

public class HabitTrackerApp {
    private static final Gson gson = new Gson();
    private static final Connection conn;

    static {
        try {
            conn = DriverManager.getConnection("jdbc:h2:mem:habits;DB_CLOSE_DELAY=-1");
            initSchema();
            seedData();
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    private static void initSchema() throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("""
                CREATE TABLE IF NOT EXISTS habits (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    category VARCHAR(100) NOT NULL DEFAULT 'general',
                    color VARCHAR(20) NOT NULL DEFAULT '#8b5cf6',
                    icon VARCHAR(10) NOT NULL DEFAULT '⭐',
                    target_days VARCHAR(7) NOT NULL DEFAULT '1234567',
                    archived BOOLEAN DEFAULT FALSE,
                    created_at DATE NOT NULL DEFAULT CURRENT_DATE
                )
            """);
            stmt.execute("""
                CREATE TABLE IF NOT EXISTS completions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    habit_id INT NOT NULL,
                    completed_date DATE NOT NULL,
                    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
                    UNIQUE(habit_id, completed_date)
                )
            """);
        }
    }

    private static void seedData() throws SQLException {
        LocalDate today = LocalDate.now();

        // Create sample habits
        int h1 = insertHabit("Morning Run", "fitness", "#ef4444", "\uD83C\uDFC3", "12345");
        int h2 = insertHabit("Read 30 min", "learning", "#3b82f6", "\uD83D\uDCDA", "1234567");
        int h3 = insertHabit("Meditate", "mindfulness", "#8b5cf6", "\uD83E\uDDD8", "1234567");
        int h4 = insertHabit("Drink 8 Glasses", "health", "#06b6d4", "\uD83D\uDCA7", "1234567");
        int h5 = insertHabit("Practice Guitar", "creative", "#f59e0b", "\uD83C\uDFB5", "246");

        // Seed some completion history for the past 14 days
        for (int d = 13; d >= 0; d--) {
            LocalDate date = today.minusDays(d);
            int dow = date.getDayOfWeek().getValue(); // 1=Mon .. 7=Sun

            // Morning Run (weekdays) - mostly completed
            if ("12345".contains(String.valueOf(dow)) && Math.random() > 0.2)
                insertCompletion(h1, date);
            // Read 30 min - high completion
            if (Math.random() > 0.15)
                insertCompletion(h2, date);
            // Meditate - moderate completion
            if (Math.random() > 0.35)
                insertCompletion(h3, date);
            // Drink water - very high
            if (Math.random() > 0.1)
                insertCompletion(h4, date);
            // Guitar (Tue/Thu/Sat) - moderate
            if ("246".contains(String.valueOf(dow)) && Math.random() > 0.3)
                insertCompletion(h5, date);
        }
    }

    private static int insertHabit(String name, String category, String color, String icon, String targetDays) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO habits (name, category, color, icon, target_days) VALUES (?, ?, ?, ?, ?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, name);
            ps.setString(2, category);
            ps.setString(3, color);
            ps.setString(4, icon);
            ps.setString(5, targetDays);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                rs.next();
                return rs.getInt(1);
            }
        }
    }

    private static void insertCompletion(int habitId, LocalDate date) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "MERGE INTO completions (habit_id, completed_date) KEY (habit_id, completed_date) VALUES (?, ?)")) {
            ps.setInt(1, habitId);
            ps.setDate(2, Date.valueOf(date));
            ps.executeUpdate();
        }
    }

    // ──────────────────── Entry Point ────────────────────

    public static void main(String[] args) throws Exception {
        System.out.println("Starting Habit Tracker...");
        registerRoutes(DevServer::route);
        DevServer.main(args);
    }

    public static void registerRoutes(BiConsumer<String, Function<String, String>> register) {

        // ── Categories (static) ──
        register.accept("habits/categories", payload -> {
            List<Map<String, String>> cats = List.of(
                Map.of("name", "fitness",     "color", "#ef4444", "icon", "\uD83C\uDFC3"),
                Map.of("name", "health",      "color", "#06b6d4", "icon", "\uD83D\uDCA7"),
                Map.of("name", "learning",    "color", "#3b82f6", "icon", "\uD83D\uDCDA"),
                Map.of("name", "mindfulness", "color", "#8b5cf6", "icon", "\uD83E\uDDD8"),
                Map.of("name", "creative",    "color", "#f59e0b", "icon", "\uD83C\uDFA8"),
                Map.of("name", "productivity","color", "#10b981", "icon", "\uD83D\uDCBB"),
                Map.of("name", "social",      "color", "#ec4899", "icon", "\uD83D\uDC4B"),
                Map.of("name", "general",     "color", "#6b7280", "icon", "\u2B50")
            );
            return gson.toJson(cats);
        });

        // ── List all habits ──
        register.accept("habits/list", payload -> {
            try {
                List<Map<String, Object>> habits = new ArrayList<>();
                LocalDate today = LocalDate.now();
                try (PreparedStatement ps = conn.prepareStatement(
                        "SELECT * FROM habits WHERE archived = FALSE ORDER BY id")) {
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            Map<String, Object> h = habitFromRow(rs);
                            h.put("currentStreak", computeCurrentStreak(rs.getInt("id"), rs.getString("target_days"), today));
                            h.put("bestStreak", computeBestStreak(rs.getInt("id"), rs.getString("target_days")));
                            habits.add(h);
                        }
                    }
                }
                return gson.toJson(habits);
            } catch (SQLException e) {
                return error(e.getMessage());
            }
        });

        // ── Today's habits with completion status ──
        register.accept("habits/today", payload -> {
            try {
                LocalDate today = LocalDate.now();
                int dow = today.getDayOfWeek().getValue();
                String dowStr = String.valueOf(dow);

                List<Map<String, Object>> habits = new ArrayList<>();
                int completedCount = 0;

                try (PreparedStatement ps = conn.prepareStatement(
                        "SELECT h.*, (SELECT COUNT(*) FROM completions c WHERE c.habit_id = h.id AND c.completed_date = ?) AS done " +
                        "FROM habits h WHERE h.archived = FALSE ORDER BY h.id")) {
                    ps.setDate(1, Date.valueOf(today));
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            String targetDays = rs.getString("target_days");
                            if (!targetDays.contains(dowStr)) continue;

                            Map<String, Object> h = habitFromRow(rs);
                            boolean completed = rs.getInt("done") > 0;
                            h.put("completed", completed);
                            h.put("streak", computeCurrentStreak(rs.getInt("id"), targetDays, today));
                            habits.add(h);
                            if (completed) completedCount++;
                        }
                    }
                }

                Map<String, Object> result = new LinkedHashMap<>();
                result.put("date", today.toString());
                result.put("dayOfWeek", dow);
                result.put("habits", habits);
                result.put("completedCount", completedCount);
                result.put("totalCount", habits.size());
                return gson.toJson(result);
            } catch (SQLException e) {
                return error(e.getMessage());
            }
        });

        // ── Toggle habit completion for today ──
        register.accept("habits/toggle", payload -> {
            Double idD = extractDouble(payload, "id");
            if (idD == null) return error("Missing id");
            int id = idD.intValue();
            try {
                LocalDate today = LocalDate.now();
                // Check if already completed
                boolean exists;
                try (PreparedStatement ps = conn.prepareStatement(
                        "SELECT COUNT(*) FROM completions WHERE habit_id = ? AND completed_date = ?")) {
                    ps.setInt(1, id);
                    ps.setDate(2, Date.valueOf(today));
                    try (ResultSet rs = ps.executeQuery()) {
                        rs.next();
                        exists = rs.getInt(1) > 0;
                    }
                }
                if (exists) {
                    try (PreparedStatement ps = conn.prepareStatement(
                            "DELETE FROM completions WHERE habit_id = ? AND completed_date = ?")) {
                        ps.setInt(1, id);
                        ps.setDate(2, Date.valueOf(today));
                        ps.executeUpdate();
                    }
                } else {
                    insertCompletion(id, today);
                }
                return success();
            } catch (SQLException e) {
                return error(e.getMessage());
            }
        });

        // ── Create habit ──
        register.accept("habits/create", payload -> {
            String name = extractString(payload, "name");
            String category = extractString(payload, "category");
            String color = extractString(payload, "color");
            String icon = extractString(payload, "icon");
            String targetDays = extractString(payload, "targetDays");
            if (name == null || name.isBlank()) return error("Missing name");
            if (category == null) category = "general";
            if (color == null) color = "#6b7280";
            if (icon == null) icon = "\u2B50";
            if (targetDays == null) targetDays = "1234567";

            try {
                insertHabit(name, category, color, icon, targetDays);
                return success();
            } catch (SQLException e) {
                return error(e.getMessage());
            }
        });

        // ── Update habit ──
        register.accept("habits/update", payload -> {
            Double idD = extractDouble(payload, "id");
            if (idD == null) return error("Missing id");
            String name = extractString(payload, "name");
            String category = extractString(payload, "category");
            String color = extractString(payload, "color");
            String icon = extractString(payload, "icon");
            String targetDays = extractString(payload, "targetDays");
            if (name == null || name.isBlank()) return error("Missing name");

            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE habits SET name=?, category=?, color=?, icon=?, target_days=? WHERE id=?")) {
                ps.setString(1, name);
                ps.setString(2, category != null ? category : "general");
                ps.setString(3, color != null ? color : "#6b7280");
                ps.setString(4, icon != null ? icon : "\u2B50");
                ps.setString(5, targetDays != null ? targetDays : "1234567");
                ps.setInt(6, idD.intValue());
                ps.executeUpdate();
                return success();
            } catch (SQLException e) {
                return error(e.getMessage());
            }
        });

        // ── Delete habit ──
        register.accept("habits/delete", payload -> {
            Double idD = extractDouble(payload, "id");
            if (idD == null) return error("Missing id");
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM habits WHERE id = ?")) {
                ps.setInt(1, idD.intValue());
                ps.executeUpdate();
                return success();
            } catch (SQLException e) {
                return error(e.getMessage());
            }
        });

        // ── Stats ──
        register.accept("habits/stats", payload -> {
            try {
                String period = extractString(payload, "period");
                if (period == null) period = "week";

                LocalDate today = LocalDate.now();
                LocalDate startDate;
                if ("month".equals(period)) {
                    startDate = today.withDayOfMonth(1);
                } else {
                    startDate = today.with(DayOfWeek.MONDAY);
                }

                long totalDaysInPeriod = ChronoUnit.DAYS.between(startDate, today) + 1;

                // Get all active habits
                List<Map<String, Object>> habitRows = new ArrayList<>();
                try (PreparedStatement ps = conn.prepareStatement(
                        "SELECT * FROM habits WHERE archived = FALSE ORDER BY id")) {
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            Map<String, Object> h = new LinkedHashMap<>();
                            h.put("id", rs.getInt("id"));
                            h.put("name", rs.getString("name"));
                            h.put("icon", rs.getString("icon"));
                            h.put("color", rs.getString("color"));
                            h.put("targetDays", rs.getString("target_days"));
                            habitRows.add(h);
                        }
                    }
                }

                int totalCompleted = 0;
                int totalPossible = 0;
                String bestStreakHabit = "N/A";
                int bestStreakDays = 0;

                List<Map<String, Object>> habitStats = new ArrayList<>();

                for (Map<String, Object> h : habitRows) {
                    int hid = (int) h.get("id");
                    String targetDays = (String) h.get("targetDays");

                    // Count applicable days in period
                    int applicable = 0;
                    int completed = 0;
                    for (long d = 0; d < totalDaysInPeriod; d++) {
                        LocalDate date = startDate.plusDays(d);
                        int dow = date.getDayOfWeek().getValue();
                        if (targetDays.contains(String.valueOf(dow))) {
                            applicable++;
                            if (isCompleted(hid, date)) completed++;
                        }
                    }

                    totalCompleted += completed;
                    totalPossible += applicable;

                    int currentStreak = computeCurrentStreak(hid, targetDays, today);
                    int best = computeBestStreak(hid, targetDays);

                    if (best > bestStreakDays) {
                        bestStreakDays = best;
                        bestStreakHabit = (String) h.get("name");
                    }

                    Map<String, Object> stat = new LinkedHashMap<>();
                    stat.put("id", hid);
                    stat.put("name", h.get("name"));
                    stat.put("icon", h.get("icon"));
                    stat.put("color", h.get("color"));
                    stat.put("completionRate", applicable > 0 ? (completed * 100.0 / applicable) : 0);
                    stat.put("completedDays", completed);
                    stat.put("totalDays", applicable);
                    stat.put("currentStreak", currentStreak);
                    stat.put("bestStreak", best);
                    habitStats.add(stat);
                }

                // Daily data for bar chart
                List<Map<String, Object>> dailyData = new ArrayList<>();
                for (long d = 0; d < totalDaysInPeriod; d++) {
                    LocalDate date = startDate.plusDays(d);
                    int dow = date.getDayOfWeek().getValue();
                    int dayTotal = 0;
                    int dayDone = 0;
                    for (Map<String, Object> h : habitRows) {
                        String td = (String) h.get("targetDays");
                        if (td.contains(String.valueOf(dow))) {
                            dayTotal++;
                            if (isCompleted((int) h.get("id"), date)) dayDone++;
                        }
                    }
                    Map<String, Object> dd = new LinkedHashMap<>();
                    dd.put("date", date.toString());
                    dd.put("completed", dayDone);
                    dd.put("total", dayTotal);
                    dd.put("rate", dayTotal > 0 ? (dayDone * 100.0 / dayTotal) : 0);
                    dailyData.add(dd);
                }

                Map<String, Object> result = new LinkedHashMap<>();
                result.put("period", period);
                result.put("startDate", startDate.toString());
                result.put("endDate", today.toString());
                result.put("overallRate", totalPossible > 0 ? (totalCompleted * 100.0 / totalPossible) : 0);
                result.put("totalCompleted", totalCompleted);
                result.put("totalPossible", totalPossible);

                Map<String, Object> bestObj = new LinkedHashMap<>();
                bestObj.put("habitName", bestStreakHabit);
                bestObj.put("days", bestStreakDays);
                result.put("bestStreak", bestObj);

                result.put("habitStats", habitStats);
                result.put("dailyData", dailyData);

                return gson.toJson(result);
            } catch (SQLException e) {
                return error(e.getMessage());
            }
        });
    }

    // ──────────────────── Streak Computation ────────────────────

    private static int computeCurrentStreak(int habitId, String targetDays, LocalDate today) throws SQLException {
        int streak = 0;
        LocalDate date = today;

        // If today is not a target day, start from the most recent target day
        while (!targetDays.contains(String.valueOf(date.getDayOfWeek().getValue()))) {
            date = date.minusDays(1);
        }

        // Walk backwards through target days
        while (true) {
            if (targetDays.contains(String.valueOf(date.getDayOfWeek().getValue()))) {
                if (isCompleted(habitId, date)) {
                    streak++;
                } else {
                    break;
                }
            }
            date = date.minusDays(1);
            if (ChronoUnit.DAYS.between(date, today) > 365) break;
        }
        return streak;
    }

    private static int computeBestStreak(int habitId, String targetDays) throws SQLException {
        // Get all completions sorted
        List<LocalDate> completions = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT completed_date FROM completions WHERE habit_id = ? ORDER BY completed_date")) {
            ps.setInt(1, habitId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    completions.add(rs.getDate("completed_date").toLocalDate());
                }
            }
        }
        if (completions.isEmpty()) return 0;

        Set<LocalDate> completionSet = new HashSet<>(completions);
        int best = 0;
        int current = 0;

        // Walk from first completion to today
        LocalDate start = completions.getFirst();
        LocalDate end = LocalDate.now();

        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            if (!targetDays.contains(String.valueOf(d.getDayOfWeek().getValue()))) {
                continue; // Skip non-target days
            }
            if (completionSet.contains(d)) {
                current++;
                best = Math.max(best, current);
            } else {
                current = 0;
            }
        }
        return best;
    }

    private static boolean isCompleted(int habitId, LocalDate date) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT COUNT(*) FROM completions WHERE habit_id = ? AND completed_date = ?")) {
            ps.setInt(1, habitId);
            ps.setDate(2, Date.valueOf(date));
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getInt(1) > 0;
            }
        }
    }

    // ──────────────────── Helpers ────────────────────

    private static Map<String, Object> habitFromRow(ResultSet rs) throws SQLException {
        Map<String, Object> h = new LinkedHashMap<>();
        h.put("id", rs.getInt("id"));
        h.put("name", rs.getString("name"));
        h.put("category", rs.getString("category"));
        h.put("color", rs.getString("color"));
        h.put("icon", rs.getString("icon"));
        h.put("targetDays", rs.getString("target_days"));
        return h;
    }

    @SuppressWarnings("unchecked")
    static String extractString(String json, String key) {
        if (json == null || json.isEmpty() || json.equals("{}")) return null;
        try {
            Map<String, Object> map = gson.fromJson(json, Map.class);
            Object val = map.get(key);
            return val != null ? val.toString() : null;
        } catch (Exception e) { return null; }
    }

    @SuppressWarnings("unchecked")
    static Double extractDouble(String json, String key) {
        if (json == null || json.isEmpty() || json.equals("{}")) return null;
        try {
            Map<String, Object> map = gson.fromJson(json, Map.class);
            Object val = map.get(key);
            if (val instanceof Number) return ((Number) val).doubleValue();
            return null;
        } catch (Exception e) { return null; }
    }

    static String error(String msg) {
        return "{\"error\":\"" + msg.replace("\"", "'") + "\"}";
    }

    static String success() {
        return "{\"success\":true}";
    }
}
