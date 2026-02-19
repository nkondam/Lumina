---
layout: default
title: Frontend Development
nav_order: 3
---

# Frontend Development Guide

This guide covers patterns and best practices for developing the TypeScript/JavaScript frontend in Lumina applications.

## Development Workflow

### Local Development

```bash
cd ui-template
npm install
npm run dev
```

Note: `window.lumina` won't be available in browser. Create a mock for development.

### Mocking the Backend

```typescript
// src/mock-lumina.ts
const mockHandlers: Record<string, (payload: any) => any> = {
  "ping": () => ({ pong: true }),
  "users/list": () => ({
    users: [
      { id: "1", name: "Alice", email: "alice@example.com" },
      { id: "2", name: "Bob", email: "bob@example.com" },
    ]
  }),
};

export function setupMockLumina() {
  if (typeof window.lumina === 'undefined') {
    window.lumina = {
      send: async (route: string, payload?: string) => {
        await new Promise(r => setTimeout(r, 100));
        const handler = mockHandlers[route];
        if (!handler) throw new Error(`Unknown route: ${route}`);
        const input = payload ? JSON.parse(payload) : {};
        return JSON.stringify(handler(input));
      }
    };
  }
}
```

## TypeScript API Client

```typescript
// src/api/client.ts
export class LuminaClient {
  private async send<TReq, TRes>(route: string, request?: TReq): Promise<TRes> {
    const payload = request ? JSON.stringify(request) : undefined;
    const response = await window.lumina.send(route, payload);
    return JSON.parse(response);
  }

  async listUsers() {
    return this.send<void, { users: User[] }>("users/list");
  }

  async createUser(req: CreateUserRequest) {
    return this.send("users/create", req);
  }
}

export const api = new LuminaClient();
```

## Using React

```bash
npm install react react-dom
npm install -D @types/react @types/react-dom @vitejs/plugin-react
```

Update `vite.config.ts`:

```typescript
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react(), viteSingleFile()],
});
```

## Using Vue 3

```bash
npm install vue
npm install -D @vitejs/plugin-vue
```

## CSS Design System

```css
:root {
  --color-primary: #6366f1;
  --color-bg: #ffffff;
  --color-text: #0f172a;
  --radius-md: 0.5rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0f172a;
    --color-text: #f1f5f9;
  }
}
```

## Performance Tips

1. **Batch IPC calls** - Combine related requests
2. **Cache responses** - Use in-memory cache for static data
3. **Debounce input** - Use 300ms debounce for search
