---
layout: default
title: Backend Development
nav_order: 4
---

# Backend Development Guide

This guide covers advanced patterns and best practices for developing the Java backend in Lumina applications.

## Route Organization

### Simple Routes

For small applications, define routes inline:

```java
LuminaRuntime.builder()
    .route("ping", payload -> "{\"pong\":true}")
    .route("version", payload -> "{\"version\":\"1.0.0\"}")
    .build();
```

### Handler Classes

For larger applications, organize routes into handler classes:

```java
public class UserHandler {
    private final UserRepository repository;
    
    public UserHandler(UserRepository repository) {
        this.repository = repository;
    }
    
    public void registerRoutes(LuminaRuntime.Builder builder) {
        builder
            .route("users/list", this::list)
            .route("users/get", this::get)
            .route("users/create", this::create)
            .route("users/update", this::update)
            .route("users/delete", this::delete);
    }
    
    private String list(String payload) {
        List<User> users = repository.findAll();
        return toJson(users);
    }
    
    private String get(String payload) {
        String id = parseId(payload);
        return toJson(repository.findById(id));
    }
    
    // ... other handlers
}
```

### Modular Registration

```java
public class Application {
    public static void initialize() {
        var builder = LuminaRuntime.builder();
        
        // Register handlers from different modules
        new UserHandler(new UserRepository()).registerRoutes(builder);
        new ProductHandler(new ProductRepository()).registerRoutes(builder);
        new OrderHandler(new OrderRepository()).registerRoutes(builder);
        
        builder.build();
    }
}
```

## Working with JSON

### Using Gson

Add the dependency:

```kotlin
// build.gradle.kts
dependencies {
    implementation("com.google.code.gson:gson:2.11.0")
}
```

Create a JSON utility class:

```java
public final class Json {
    private static final Gson GSON = new GsonBuilder()
        .setDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ")
        .create();
    
    public static <T> T fromJson(String json, Class<T> type) {
        return GSON.fromJson(json, type);
    }
    
    public static <T> T fromJson(String json, TypeToken<T> type) {
        return GSON.fromJson(json, type.getType());
    }
    
    public static String toJson(Object obj) {
        return GSON.toJson(obj);
    }
    
    private Json() {}
}
```

Usage in handlers:

```java
.route("users/create", payload -> {
    CreateUserRequest request = Json.fromJson(payload, CreateUserRequest.class);
    User user = userService.create(request);
    return Json.toJson(new CreateUserResponse(user.getId()));
})
```

### Request/Response DTOs

Define clear data transfer objects:

```java
// Requests
public record CreateUserRequest(String name, String email) {}
public record UpdateUserRequest(String id, String name, String email) {}
public record DeleteUserRequest(String id) {}

// Responses
public record UserResponse(String id, String name, String email, Instant createdAt) {}
public record ListUsersResponse(List<UserResponse> users, int total) {}
public record ErrorResponse(String error, String message) {}
```

### Error Handling

Implement consistent error handling:

```java
public abstract class BaseHandler {
    protected final String handle(String payload, Function<String, String> action) {
        try {
            return action.apply(payload);
        } catch (NotFoundException e) {
            return Json.toJson(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (ValidationException e) {
            return Json.toJson(new ErrorResponse("VALIDATION_ERROR", e.getMessage()));
        } catch (Exception e) {
            return Json.toJson(new ErrorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
        }
    }
}

// Usage
.route("users/get", payload -> handle(payload, p -> {
    String id = Json.fromJson(p, GetUserRequest.class).id();
    User user = repository.findById(id)
        .orElseThrow(() -> new NotFoundException("User not found: " + id));
    return Json.toJson(UserResponse.from(user));
}))
```

## Database Access

### SQLite with JDBC

Add the dependency:

```kotlin
dependencies {
    implementation("org.xerial:sqlite-jdbc:3.46.0.0")
}
```

Create a simple connection manager:

```java
public class Database {
    private static final String DB_PATH = getDbPath();
    
    private static String getDbPath() {
        // Store in user's app data directory
        String home = System.getProperty("user.home");
        return home + "/.myapp/data.db";
    }
    
    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection("jdbc:sqlite:" + DB_PATH);
    }
    
    public static void initialize() {
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement()) {
            
            stmt.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    created_at INTEGER NOT NULL
                )
            """);
            
        } catch (SQLException e) {
            throw new RuntimeException("Failed to initialize database", e);
        }
    }
}
```

### Repository Pattern

```java
public class UserRepository {
    
    public List<User> findAll() {
        try (Connection conn = Database.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT * FROM users ORDER BY created_at DESC")) {
            
            List<User> users = new ArrayList<>();
            while (rs.next()) {
                users.add(mapUser(rs));
            }
            return users;
            
        } catch (SQLException e) {
            throw new RepositoryException("Failed to list users", e);
        }
    }
    
    public Optional<User> findById(String id) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement("SELECT * FROM users WHERE id = ?")) {
            
            stmt.setString(1, id);
            try (ResultSet rs = stmt.executeQuery()) {
                return rs.next() ? Optional.of(mapUser(rs)) : Optional.empty();
            }
            
        } catch (SQLException e) {
            throw new RepositoryException("Failed to find user: " + id, e);
        }
    }
    
    public User create(String name, String email) {
        String id = UUID.randomUUID().toString();
        long createdAt = Instant.now().toEpochMilli();
        
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement(
                 "INSERT INTO users (id, name, email, created_at) VALUES (?, ?, ?, ?)")) {
            
            stmt.setString(1, id);
            stmt.setString(2, name);
            stmt.setString(3, email);
            stmt.setLong(4, createdAt);
            stmt.executeUpdate();
            
            return new User(id, name, email, Instant.ofEpochMilli(createdAt));
            
        } catch (SQLException e) {
            throw new RepositoryException("Failed to create user", e);
        }
    }
    
    private User mapUser(ResultSet rs) throws SQLException {
        return new User(
            rs.getString("id"),
            rs.getString("name"),
            rs.getString("email"),
            Instant.ofEpochMilli(rs.getLong("created_at"))
        );
    }
}
```

## GraalVM Native Image Configuration

### Reflection

If using libraries that rely on reflection (like Gson), create configuration files:

**`META-INF/native-image/reflect-config.json`**

```json
[
  {
    "name": "com.myapp.dto.CreateUserRequest",
    "allDeclaredConstructors": true,
    "allDeclaredFields": true
  },
  {
    "name": "com.myapp.dto.UserResponse",
    "allDeclaredConstructors": true,
    "allDeclaredFields": true
  }
]
```

### Resources

For files that need to be accessible at runtime:

**`META-INF/native-image/resource-config.json`**

```json
{
  "resources": {
    "includes": [
      {"pattern": "schema/.*\\.sql$"},
      {"pattern": "config/.*\\.properties$"}
    ]
  }
}
```

### Tracing Agent

For complex applications, use the tracing agent to auto-generate configs:

```bash
# Run your app with the agent
java -agentlib:native-image-agent=config-output-dir=META-INF/native-image \
     -jar myapp.jar

# Then build with the generated configs
./gradlew nativeCompile
```

## Async Operations

### Background Tasks

For long-running operations, respond immediately and process in the background:

```java
private final ExecutorService executor = Executors.newFixedThreadPool(4);

.route("export/start", payload -> {
    ExportRequest request = Json.fromJson(payload, ExportRequest.class);
    String jobId = UUID.randomUUID().toString();
    
    // Start background job
    executor.submit(() -> {
        try {
            performExport(jobId, request);
        } catch (Exception e) {
            markJobFailed(jobId, e);
        }
    });
    
    return Json.toJson(new ExportStartedResponse(jobId));
})

.route("export/status", payload -> {
    String jobId = Json.fromJson(payload, JobStatusRequest.class).jobId();
    JobStatus status = getJobStatus(jobId);
    return Json.toJson(status);
})
```

### Progress Updates

For progress updates, the frontend can poll:

```typescript
async function exportWithProgress(request: ExportRequest) {
  const { jobId } = await lumina.send("export/start", request);
  
  while (true) {
    await sleep(500); // Poll every 500ms
    const status = await lumina.send("export/status", { jobId });
    
    updateProgressUI(status.progress);
    
    if (status.completed) {
      return status.result;
    }
    if (status.failed) {
      throw new Error(status.error);
    }
  }
}
```

## Testing

### Unit Testing Handlers

```java
class UserHandlerTest {
    private UserHandler handler;
    private UserRepository mockRepository;
    
    @BeforeEach
    void setUp() {
        mockRepository = mock(UserRepository.class);
        handler = new UserHandler(mockRepository);
    }
    
    @Test
    void listUsers_returnsJsonArray() {
        when(mockRepository.findAll()).thenReturn(List.of(
            new User("1", "Alice", "alice@example.com", Instant.now()),
            new User("2", "Bob", "bob@example.com", Instant.now())
        ));
        
        String result = handler.list("{}");
        
        ListUsersResponse response = Json.fromJson(result, ListUsersResponse.class);
        assertEquals(2, response.users().size());
        assertEquals("Alice", response.users().get(0).name());
    }
    
    @Test
    void getUser_notFound_returnsError() {
        when(mockRepository.findById("999")).thenReturn(Optional.empty());
        
        String result = handler.get("{\"id\":\"999\"}");
        
        ErrorResponse error = Json.fromJson(result, ErrorResponse.class);
        assertEquals("NOT_FOUND", error.error());
    }
}
```

### Integration Testing

You can test the full route registration:

```java
class IntegrationTest {
    @BeforeAll
    static void setUp() {
        Application.initialize();
    }
    
    @Test
    void pingRoute_returnsPong() {
        String response = LuminaBridge.testHandle("ping", "{}");
        assertTrue(response.contains("\"pong\":true"));
    }
}
```

## Best Practices

### 1. Keep Handlers Thin

Route handlers should delegate to services:

```java
// ❌ Bad: Business logic in handler
.route("users/create", payload -> {
    var request = Json.fromJson(payload, CreateUserRequest.class);
    // Validation, database access, notifications all mixed in
    if (request.email() == null) throw new ValidationException("...");
    var user = repository.create(...);
    emailService.sendWelcome(user);
    return Json.toJson(user);
})

// ✅ Good: Handler delegates to service
.route("users/create", payload -> {
    var request = Json.fromJson(payload, CreateUserRequest.class);
    var response = userService.create(request);
    return Json.toJson(response);
})
```

### 2. Use Consistent Response Formats

Define a standard response envelope:

```java
public record ApiResponse<T>(
    boolean success,
    T data,
    ErrorInfo error
) {
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null);
    }
    
    public static <T> ApiResponse<T> error(String code, String message) {
        return new ApiResponse<>(false, null, new ErrorInfo(code, message));
    }
}
```

### 3. Document Routes

Keep a clear inventory of routes:

```java
/**
 * Route: users/create
 * Request: { "name": "string", "email": "string" }
 * Response: { "success": true, "data": { "id": "string" } }
 *           { "success": false, "error": { "code": "...", "message": "..." } }
 */
.route("users/create", userHandler::create)
```

### 4. Handle Shutdown Gracefully

Clean up resources when the app closes:

```java
public class Application {
    private static ExecutorService executor;
    
    public static void initialize() {
        executor = Executors.newFixedThreadPool(4);
        Database.initialize();
        // ...
    }
    
    public static void shutdown() {
        executor.shutdown();
        try {
            executor.awaitTermination(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            executor.shutdownNow();
        }
    }
}
```

## Next Steps

- [Frontend Development Guide](frontend-development.md) — Build the UI
- [Deployment Guide](deployment.md) — Package your application
