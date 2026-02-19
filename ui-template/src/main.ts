declare global {
  interface Window {
    lumina: {
      send: (route: string, payload?: unknown) => Promise<unknown>;
    };
  }
}

// Dev mode fallback
if (!window.lumina) {
  window.lumina = {
    send: async (route: string, payload?: unknown): Promise<unknown> => {
      const body = typeof payload === "string" ? payload : JSON.stringify(payload || {});
      const res = await fetch("http://localhost:8080/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route, payload: body }),
      });
      return res.json();
    },
  };
}

// --- Styles ---
const style = document.createElement("style");
style.textContent = `
  :root {
    --bg: #09090b;
    --surface: rgba(24, 24, 27, 0.6);
    --border: rgba(255, 255, 255, 0.1);
    --primary: #8b5cf6;
    --primary-glow: rgba(139, 92, 246, 0.5);
    --text: #e4e4e7;
    --text-dim: #a1a1aa;
    --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }

  .bg-gradient {
    position: absolute;
    width: 100%;
    height: 100%;
    background: 
      radial-gradient(circle at 15% 50%, rgba(59, 130, 246, 0.15), transparent 25%),
      radial-gradient(circle at 85% 30%, rgba(139, 92, 246, 0.15), transparent 25%);
    z-index: 0;
  }

  .card {
    position: relative;
    z-index: 1;
    background: var(--surface);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid var(--border);
    border-radius: 24px;
    padding: 3rem;
    width: 440px;
    max-width: 90vw;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    transition: transform 0.3s ease;
  }

  .logo-container {
    width: 80px;
    height: 80px;
    margin-bottom: 2rem;
    position: relative;
  }

  .logo-glow {
    position: absolute;
    inset: -20px;
    background: radial-gradient(circle, var(--primary-glow), transparent 70%);
    opacity: 0.5;
    animation: pulse 4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.1); }
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    background: linear-gradient(to right, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.05em;
  }

  p {
    color: var(--text-dim);
    text-align: center;
    line-height: 1.6;
    margin-bottom: 2rem;
    font-size: 1.1rem;
  }

  .actions {
    display: flex;
    gap: 1rem;
    width: 100%;
  }

  button {
    flex: 1;
    border: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.03);
    color: var(--text);
    padding: 0.75rem;
    border-radius: 12px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  button:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }

  button:active {
    transform: translateY(0);
  }

  button.primary {
    background: var(--primary);
    border-color: var(--primary);
    box-shadow: 0 4px 20px -5px var(--primary-glow);
  }

  button.primary:hover {
    background: #7c3aed;
  }

  .status-bar {
    margin-top: 2rem;
    width: 100%;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.85rem;
    color: var(--text-dim);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ef4444; /* red */
    transition: background 0.3s;
  }

  .dot.connected {
    background: #22c55e; /* green */
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.4);
  }

  #response {
    color: #fff;
    opacity: 0;
    transition: opacity 0.3s;
  }
  #response.visible {
    opacity: 1;
  }
`;
document.head.appendChild(style);

// --- Layout ---
const app = document.getElementById("app")!;
app.innerHTML = `
  <div class="bg-gradient"></div>
  <div class="card">
    <div class="logo-container">
      <div class="logo-glow"></div>
      <svg width="100%" height="100%" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 4L58 19V49L32 64L6 49V19L32 4Z" fill="url(#grad)" fill-opacity="0.1" stroke="url(#grad)" stroke-width="2"/>
        <path d="M32 30L56 18" stroke="url(#grad)" stroke-width="2" stroke-linecap="round"/>
        <path d="M32 30L8 18" stroke="url(#grad)" stroke-width="2" stroke-linecap="round"/>
        <path d="M32 30V58" stroke="url(#grad)" stroke-width="2" stroke-linecap="round"/>
        <circle cx="32" cy="30" r="3" fill="#fff" />
        <defs>
          <linearGradient id="grad" x1="6" y1="4" x2="58" y2="64" gradientUnits="userSpaceOnUse">
            <stop stop-color="#60A5FA"/>
            <stop offset="1" stop-color="#A78BFA"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
    
    <h1>Lumina</h1>
    <p>Modern Desktop Apps with JVM & Web</p>

    <div class="actions">
      <button id="ping-btn" class="primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        Ping Backend
      </button>
      <button id="doc-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
        Docs
      </button>
    </div>

    <div class="status-bar">
      <div class="status-indicator">
        <div class="dot" id="status-dot"></div>
        <span id="status-text">Disconnected</span>
      </div>
      <span id="response"></span>
    </div>
  </div>
`;

// --- Logic ---
const pingBtn = document.getElementById("ping-btn") as HTMLButtonElement;
const docBtn = document.getElementById("doc-btn") as HTMLButtonElement;
const statusDot = document.getElementById("status-dot")!;
const statusText = document.getElementById("status-text")!;
const responseEl = document.getElementById("response")!;

// Check connection on load
checkConnection();

pingBtn.addEventListener("click", async () => {
  pingBtn.disabled = true;
  pingBtn.style.opacity = "0.7";
  try {
    const start = performance.now();
    await window.lumina.send("ping");
    const diff = Math.round(performance.now() - start);

    setConnected(true);
    showResponse(`Pong! (${diff}ms)`);
  } catch (e) {
    setConnected(false);
    showResponse("Error");
  } finally {
    pingBtn.disabled = false;
    pingBtn.style.opacity = "1";
  }
});

docBtn.addEventListener("click", () => {
  window.location.href = "https://github.com/nkondam/lumina"; // Or local docs
});

async function checkConnection() {
  try {
    await window.lumina.send("ping");
    setConnected(true);
  } catch {
    setConnected(false);
  }
}

function setConnected(connected: boolean) {
  if (connected) {
    statusDot.classList.add("connected");
    statusText.textContent = "Connected";
    statusText.style.color = "#22c55e";
  } else {
    statusDot.classList.remove("connected");
    statusText.textContent = "Disconnected";
    statusText.style.color = "#ef4444";
  }
}

function showResponse(msg: string) {
  responseEl.textContent = msg;
  responseEl.classList.add("visible");
  setTimeout(() => responseEl.classList.remove("visible"), 2000);
}

export { };
