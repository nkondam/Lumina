declare global {
    interface Window {
        lumina: {
            send: (route: string, payload?: unknown) => Promise<unknown>;
        };
        show: (id: string) => void;
        listFiles: (path?: string) => void;
        listTodos: () => void;
        addTodo: () => void;
        toggleTodo: (id: number) => void;
        deleteTodo: (id: number) => void;
    }
}

// Fallback for browser dev mode
if (!window.lumina) {
    window.lumina = {
        send: async (route: string, payload: unknown) => {
            const body = typeof payload === "string" ? payload : JSON.stringify(payload || {});
            const res = await fetch("http://localhost:8080/rpc", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ route, payload: body })
            });
            return res.json();
        }
    }
}

// Initial Load
setInterval(refreshSystemInfo, 2000);
refreshSystemInfo();

async function refreshSystemInfo() {
    try {
        const data: any = await window.lumina.send("system/info");
        const osEl = document.getElementById("sys-os");
        if (osEl && data.os) osEl.textContent = data.os;

        if (document.getElementById("sys-load")) {
            document.getElementById("sys-load")!.textContent = Array.isArray(data.loadAverage) ? data.loadAverage[0].toFixed(2) : String(data.loadAverage);
        }
        document.getElementById("sys-arch")!.textContent = data.arch;
        const mem = Math.round(data.freeMemory / 1024 / 1024) + " MB free";
        document.getElementById("sys-mem")!.textContent = mem;
    } catch (e) { console.error("SysInfo Error", e); }
}

async function listFiles(path?: string) {
    try {
        const data: any = await window.lumina.send("files/list", JSON.stringify({ path }));
        if (data.error) {
            alert(data.error);
            return;
        }

        const list = document.getElementById("file-list")!;
        list.innerHTML = "";

        // Parent link
        if (data.currentPath) {
            const li = document.createElement("li");
            li.className = "item";
            li.style.cursor = "pointer";
            li.innerHTML = `<span style="color: var(--primary)">.. (Up)</span>`;
            li.onclick = () => listFiles(data.currentPath + "/..");
            list.appendChild(li);
        }

        data.files.forEach((f: any) => {
            const li = document.createElement("li");
            li.className = "item";
            li.style.cursor = "pointer";
            const icon = f.isDir ? "📁" : "📄";
            li.innerHTML = `<span>${icon} ${f.name}</span> <span style="color: #666; font-size: 0.8rem">${f.size ? (f.size / 1024).toFixed(1) + ' KB' : ''}</span>`;
            if (f.isDir) {
                li.onclick = () => listFiles(data.currentPath + "/" + f.name);
            }
            list.appendChild(li);
        });

        const input = document.getElementById("path-input") as HTMLInputElement;
        if (input) input.value = data.currentPath || "";
    } catch (e) {
        console.error(e);
    }
}

async function listTodos() {
    const todos: any = await window.lumina.send("db/todos");
    const list = document.getElementById("todo-list")!;
    list.innerHTML = "";
    todos.forEach((t: any) => {
        const li = document.createElement("li");
        li.className = "item";
        li.innerHTML = `
            <span style="${t.done ? 'text-decoration: line-through; opacity: 0.5' : ''}">${t.task}</span>
            <div style="display:flex; gap:0.5rem">
                <button onclick="window.toggleTodo(${t.id})" style="background:var(--success); color: white; border: none; padding:0.25rem 0.5rem; border-radius: 4px; cursor: pointer;">✓</button>
                <button onclick="window.deleteTodo(${t.id})" style="background:var(--danger); color: white; border: none; padding:0.25rem 0.5rem; border-radius: 4px; cursor: pointer;">✕</button>
            </div>
        `;
        list.appendChild(li);
    });
}

async function addTodo() {
    const input = document.getElementById("todo-input") as HTMLInputElement;
    if (!input.value) return;
    await window.lumina.send("db/add", JSON.stringify({ task: input.value }));
    input.value = "";
    listTodos();
}

async function toggleTodo(id: number) {
    await window.lumina.send("db/toggle", JSON.stringify({ id }));
    listTodos();
}

async function deleteTodo(id: number) {
    await window.lumina.send("db/delete", JSON.stringify({ id }));
    listTodos();
}

// Expose to window for HTML onclick handlers
window.listFiles = listFiles;
window.listTodos = listTodos;
window.addTodo = addTodo;
window.toggleTodo = toggleTodo;
window.deleteTodo = deleteTodo;

export { };
