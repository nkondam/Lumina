package app;

import dev.lumina.runtime.DevServer;
import com.google.gson.Gson;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import java.lang.management.*;
import java.nio.file.*;
import java.util.stream.Collectors;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.io.IOException;

public class ShowcaseApp {
    private static final Gson gson = new Gson();
    private static final Connection conn;

    // In-memory DB setup
    static {
        try {
            conn = DriverManager.getConnection("jdbc:h2:mem:lumina;DB_CLOSE_DELAY=-1");
            try (Statement stmt = conn.createStatement()) {
                stmt.execute(
                        "CREATE TABLE IF NOT EXISTS todos (id INT AUTO_INCREMENT PRIMARY KEY, task VARCHAR(255), done BOOLEAN DEFAULT FALSE)");
                stmt.execute("INSERT INTO todos (task) VALUES ('Welcome to Lumina Showcase')");
                stmt.execute("INSERT INTO todos (task, done) VALUES ('Explore System Info', TRUE)");
            }
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    public static void main(String[] args) throws Exception {
        System.out.println("Starting Lumina Showcase...");
        registerRoutes(DevServer::route);
        DevServer.main(args);
    }

    public static void registerRoutes(BiConsumer<String, Function<String, String>> register) {

        // --- 1. System Info ---
        register.accept("system/info", payload -> {
            Map<String, Object> info = new HashMap<>();
            OperatingSystemMXBean os = ManagementFactory.getOperatingSystemMXBean();
            info.put("arch", os.getArch());
            info.put("os", os.getName());
            info.put("processors", os.getAvailableProcessors());
            info.put("loadAverage", os.getSystemLoadAverage());
            info.put("freeMemory", Runtime.getRuntime().freeMemory());
            info.put("totalMemory", Runtime.getRuntime().totalMemory());
            // Mock CPU usage flux
            info.put("cpuUsage", Math.random() * 100);
            return gson.toJson(info);
        });

        // --- 2. File Explorer ---
        register.accept("files/list", payload -> {
            String pathStr = extractString(payload, "path");
            if (pathStr == null || pathStr.isEmpty())
                pathStr = ".";

            try {
                Path dir = Paths.get(pathStr).toAbsolutePath().normalize();
                if (!Files.exists(dir))
                    return error("Path does not exist: " + dir);
                if (!Files.isDirectory(dir))
                    dir = dir.getParent();

                List<Map<String, Object>> files = Files.list(dir)
                        .map(p -> {
                            Map<String, Object> f = new HashMap<>();
                            f.put("name", p.getFileName().toString());
                            f.put("isDir", Files.isDirectory(p));
                            try {
                                f.put("size", Files.size(p));
                            } catch (Exception e) {
                            }
                            return f;
                        })
                        .sorted((a, b) -> {
                            // Directories first
                            boolean aDir = (Boolean) a.get("isDir");
                            boolean bDir = (Boolean) b.get("isDir");
                            if (aDir != bDir)
                                return aDir ? -1 : 1;
                            return ((String) a.get("name")).compareToIgnoreCase((String) b.get("name"));
                        })
                        .collect(Collectors.toList());

                Map<String, Object> result = new HashMap<>();
                result.put("currentPath", dir.toString());
                result.put("files", files);

                return gson.toJson(result);
            } catch (Exception e) {
                return error(e.getMessage());
            }
        });

        // --- 3. Database (Todos) ---
        register.accept("db/todos", payload -> {
            List<Map<String, Object>> todos = new ArrayList<>();
            try (Statement stmt = conn.createStatement();
                    ResultSet rs = stmt.executeQuery("SELECT * FROM todos ORDER BY id DESC")) {
                while (rs.next()) {
                    Map<String, Object> t = new HashMap<>();
                    t.put("id", rs.getInt("id"));
                    t.put("task", rs.getString("task"));
                    t.put("done", rs.getBoolean("done"));
                    todos.add(t);
                }
            } catch (SQLException e) {
                return error(e.getMessage());
            }
            return gson.toJson(todos);
        });

        register.accept("db/add", payload -> {
            String task = extractString(payload, "task");
            if (task == null)
                return error("Missing task");
            try (PreparedStatement pst = conn.prepareStatement("INSERT INTO todos (task) VALUES (?)")) {
                pst.setString(1, task);
                pst.executeUpdate();
                return success();
            } catch (SQLException e) {
                return error(e.getMessage());
            }
        });

        register.accept("db/toggle", payload -> {
            Double id = extractDouble(payload, "id");
            if (id == null)
                return error("Missing id");
            try (PreparedStatement pst = conn.prepareStatement("UPDATE todos SET done = NOT done WHERE id = ?")) {
                pst.setInt(1, id.intValue());
                pst.executeUpdate();
                return success();
            } catch (SQLException e) {
                return error(e.getMessage());
            }
        });

        register.accept("db/delete", payload -> {
            Double id = extractDouble(payload, "id");
            if (id == null)
                return error("Missing id");
            try (PreparedStatement pst = conn.prepareStatement("DELETE FROM todos WHERE id = ?")) {
                pst.setInt(1, id.intValue());
                pst.executeUpdate();
                return success();
            } catch (SQLException e) {
                return error(e.getMessage());
            }
        });
    }

    // --- Helpers ---

    @SuppressWarnings("unchecked")
    static String extractString(String json, String key) {
        if (json == null || json.isEmpty() || json.equals("{}"))
            return null;
        try {
            Map<String, Object> map = gson.fromJson(json, Map.class);
            Object val = map.get(key);
            return val != null ? val.toString() : null;
        } catch (Exception e) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    static Double extractDouble(String json, String key) {
        if (json == null || json.isEmpty() || json.equals("{}"))
            return null;
        try {
            Map<String, Object> map = gson.fromJson(json, Map.class);
            Object val = map.get(key);
            if (val instanceof Number)
                return ((Number) val).doubleValue();
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    static String error(String msg) {
        return "{\"error\":\"" + msg.replace("\"", "'") + "\"}";
    }

    static String success() {
        return "{\"success\":true}";
    }
}
