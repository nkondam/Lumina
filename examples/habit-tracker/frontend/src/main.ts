declare global {
    interface Window {
        lumina: {
            send: (route: string, payload?: unknown) => Promise<unknown>;
        };
        switchTab: (tab: string) => void;
        toggleHabit: (id: number) => void;
        openAddHabit: () => void;
        openEditHabit: (id: number) => void;
        saveHabit: () => void;
        deleteHabit: (id: number) => void;
        closeModal: () => void;
        setStatsPeriod: (period: string) => void;
        selectCategory: (cat: string, color: string) => void;
        selectIcon: (icon: string) => void;
        toggleDay: (day: string) => void;
    }
}

// ── Types ──

interface Habit {
    id: number;
    name: string;
    category: string;
    color: string;
    icon: string;
    targetDays: string;
    completed?: boolean;
    streak?: number;
    currentStreak?: number;
    bestStreak?: number;
}

interface TodayData {
    date: string;
    dayOfWeek: number;
    habits: Habit[];
    completedCount: number;
    totalCount: number;
}

interface StatsData {
    period: string;
    overallRate: number;
    totalCompleted: number;
    totalPossible: number;
    bestStreak: { habitName: string; days: number };
    habitStats: Array<{
        id: number; name: string; icon: string; color: string;
        completionRate: number; completedDays: number; totalDays: number;
        currentStreak: number; bestStreak: number;
    }>;
    dailyData: Array<{ date: string; completed: number; total: number; rate: number }>;
}

interface Category {
    name: string;
    color: string;
    icon: string;
}

// ── Dev Mode Fallback ──

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

// ── SVG Icons ──

const todayIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
const statsIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;
const habitsIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
const checkSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const chevronSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;

// ── State ──

let currentTab = "today";
let todayData: TodayData | null = null;
let statsData: StatsData | null = null;
let statsPeriod = "week";
let allHabits: Habit[] = [];
let categories: Category[] = [];
let editingHabit: Habit | null = null;
let modalOpen = false;

let formState = {
    name: "",
    category: "general",
    color: "#6b7280",
    icon: "\u2B50",
    targetDays: "1234567",
};

const iconOptions = ["\uD83C\uDFC3", "\uD83D\uDCDA", "\uD83E\uDDD8", "\uD83D\uDCA7", "\uD83D\uDCBB", "\u270D\uFE0F", "\uD83C\uDFB5", "\uD83D\uDCAA", "\uD83E\uDD57", "\uD83D\uDE34", "\uD83E\uDDF9", "\uD83D\uDC8A", "\uD83C\uDFA8", "\uD83C\uDF31", "\u2B50"];

// ── Rendering ──

function render() {
    const app = document.getElementById("app")!;
    let html = renderScreen() + renderTabBar();
    if (modalOpen) html += renderModal();
    app.innerHTML = html;

    if (modalOpen) {
        const nameInput = document.getElementById("habit-name") as HTMLInputElement;
        if (nameInput) {
            nameInput.value = formState.name;
        }
    }
}

function renderTabBar(): string {
    const tabs = [
        { id: "today", label: "Today", icon: todayIcon },
        { id: "stats", label: "Stats", icon: statsIcon },
        { id: "habits", label: "Habits", icon: habitsIcon },
    ];
    return `
        <div class="tab-bar">
            ${tabs.map(t => `
                <button class="tab-btn ${currentTab === t.id ? "active" : ""}"
                        onclick="window.switchTab('${t.id}')">
                    ${t.icon}
                    <span>${t.label}</span>
                </button>
            `).join("")}
        </div>`;
}

function renderScreen(): string {
    switch (currentTab) {
        case "today": return renderTodayScreen();
        case "stats": return renderStatsScreen();
        case "habits": return renderHabitsScreen();
        default: return renderTodayScreen();
    }
}

// ── Today Screen ──

function renderTodayScreen(): string {
    if (!todayData) return `<div class="screen"><div class="empty-state">Loading...</div></div>`;

    const pct = todayData.totalCount > 0
        ? Math.round((todayData.completedCount / todayData.totalCount) * 100)
        : 0;

    const dateStr = formatDate(todayData.date);

    return `
    <div class="screen">
        <div class="screen-header">
            <div>
                <div class="screen-title">Today</div>
                <div class="screen-subtitle">${dateStr}</div>
            </div>
            <button class="add-btn" onclick="window.openAddHabit()">+</button>
        </div>

        ${renderProgressRing(pct, todayData.completedCount, todayData.totalCount)}

        <div style="margin-top: 16px;">
            ${todayData.habits.map((h, i) => renderHabitCard(h, i)).join("")}
        </div>

        ${todayData.habits.length === 0 ? `
            <div class="empty-state">
                <div class="empty-state-icon">\uD83C\uDF1F</div>
                <div>No habits scheduled for today</div>
                <div style="font-size:13px; margin-top:8px; color:var(--text-muted);">Tap + to create your first habit</div>
            </div>
        ` : ""}
    </div>`;
}

function renderProgressRing(percent: number, completed: number, total: number): string {
    const size = 150;
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;

    return `
    <div class="progress-ring-container" style="width:${size}px; height:${size}px;">
        <svg width="${size}" height="${size}">
            <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
                    fill="none" stroke="var(--surface-light)" stroke-width="${strokeWidth}" />
            <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
                    fill="none" stroke="url(#progressGrad)" stroke-width="${strokeWidth}"
                    stroke-linecap="round"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${offset}"
                    style="transform: rotate(-90deg); transform-origin: 50% 50%;
                           transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1);" />
            <defs>
                <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#60a5fa" />
                    <stop offset="100%" stop-color="#a78bfa" />
                </linearGradient>
            </defs>
        </svg>
        <div class="progress-text">
            <div class="progress-percent">${percent}%</div>
            <div class="progress-label">${completed}/${total} done</div>
        </div>
    </div>`;
}

function renderHabitCard(habit: Habit, index: number): string {
    const isComplete = habit.completed;
    return `
    <div class="habit-card ${isComplete ? "completed" : ""} animate-slide-up"
         style="animation-delay: ${index * 50}ms;"
         onclick="window.toggleHabit(${habit.id})">
        <div class="habit-icon" style="background: ${habit.color}18;">
            ${habit.icon}
        </div>
        <div class="habit-info">
            <div class="habit-name">${escapeHtml(habit.name)}</div>
            <div class="habit-streak">
                ${habit.streak && habit.streak > 0 ? `\uD83D\uDD25 ${habit.streak} day streak` : habit.category}
            </div>
        </div>
        <div class="habit-check ${isComplete ? "checked" : ""}">
            ${isComplete ? checkSvg : ""}
        </div>
    </div>`;
}

// ── Stats Screen ──

function renderStatsScreen(): string {
    if (!statsData) return `<div class="screen"><div class="empty-state">Loading...</div></div>`;

    return `
    <div class="screen">
        <div class="screen-header">
            <div class="screen-title">Statistics</div>
        </div>

        <div class="chip-row">
            <button class="chip ${statsPeriod === "week" ? "selected" : ""}"
                    onclick="window.setStatsPeriod('week')">This Week</button>
            <button class="chip ${statsPeriod === "month" ? "selected" : ""}"
                    onclick="window.setStatsPeriod('month')">This Month</button>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value" style="color: var(--success);">${statsData.overallRate.toFixed(0)}%</div>
                <div class="stat-label">Completion Rate</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statsData.totalCompleted}</div>
                <div class="stat-label">Completed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: var(--primary);">\uD83D\uDD25 ${statsData.bestStreak.days}</div>
                <div class="stat-label">Best Streak</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statsData.totalPossible}</div>
                <div class="stat-label">Total Possible</div>
            </div>
        </div>

        <div class="section-title">Daily Completion</div>
        ${renderBarChart(statsData.dailyData)}

        <div class="section-title">By Habit</div>
        ${statsData.habitStats.map((h, i) => `
            <div class="habit-card animate-slide-up" style="cursor:default; animation-delay:${i * 50}ms;">
                <div class="habit-icon" style="background: ${h.color}18;">${h.icon}</div>
                <div class="habit-info" style="flex:1;">
                    <div class="habit-name">${escapeHtml(h.name)}</div>
                    <div class="habit-streak">${h.completionRate.toFixed(0)}% \u2022 ${h.completedDays}/${h.totalDays} days</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:14px; font-weight:600;">\uD83D\uDD25 ${h.currentStreak}</div>
                    <div style="font-size:11px; color:var(--text-muted);">Best: ${h.bestStreak}</div>
                </div>
            </div>
        `).join("")}
    </div>`;
}

function renderBarChart(dailyData: StatsData["dailyData"]): string {
    return `
    <div class="bar-chart">
        ${dailyData.map(d => {
            const dayLabel = new Date(d.date + "T12:00:00").toLocaleDateString("en", { weekday: "short" }).slice(0, 2);
            return `
            <div class="bar-wrapper">
                <div class="bar-col">
                    <div class="bar" style="height: ${Math.max(d.rate, 3)}%;"></div>
                </div>
                <div class="bar-label">${dayLabel}</div>
            </div>`;
        }).join("")}
    </div>`;
}

// ── Habits List Screen ──

function renderHabitsScreen(): string {
    return `
    <div class="screen">
        <div class="screen-header">
            <div class="screen-title">My Habits</div>
            <button class="new-habit-btn" onclick="window.openAddHabit()">+ New</button>
        </div>

        ${allHabits.length === 0 ? `
            <div class="empty-state">
                <div class="empty-state-icon">\uD83D\uDCCB</div>
                <div>No habits yet</div>
                <div style="font-size:13px; margin-top:8px; color:var(--text-muted);">Create your first habit to get started</div>
            </div>
        ` : ""}

        ${allHabits.map((h, i) => `
            <div class="habit-card animate-slide-up" style="animation-delay: ${i * 50}ms;"
                 onclick="window.openEditHabit(${h.id})">
                <div class="habit-icon" style="background: ${h.color}18;">${h.icon}</div>
                <div class="habit-info">
                    <div class="habit-name">${escapeHtml(h.name)}</div>
                    <div class="habit-streak">
                        ${h.category} \u2022 \uD83D\uDD25 ${h.currentStreak || 0} current / ${h.bestStreak || 0} best
                    </div>
                </div>
                <div class="chevron">${chevronSvg}</div>
            </div>
        `).join("")}
    </div>`;
}

// ── Modal (Bottom Sheet) ──

function renderModal(): string {
    const isEditing = editingHabit !== null;
    const title = isEditing ? "Edit Habit" : "New Habit";
    const dayNames = ["M", "T", "W", "T", "F", "S", "S"];
    const dayNumbers = ["1", "2", "3", "4", "5", "6", "7"];

    return `
    <div class="modal-overlay" onclick="if(event.target===this) window.closeModal()">
        <div class="modal-sheet">
            <div class="modal-handle"></div>
            <div class="modal-title">${title}</div>

            <div class="form-group">
                <label class="form-label">Name</label>
                <input class="form-input" id="habit-name" placeholder="e.g., Morning Run"
                       autocomplete="off" />
            </div>

            <div class="form-group">
                <label class="form-label">Category</label>
                <div class="category-picker">
                    ${categories.map(c => `
                        <button class="chip ${formState.category === c.name ? "selected" : ""}"
                                style="${formState.category === c.name ? `border-color:${c.color}; background:${c.color}20;` : ""}"
                                onclick="window.selectCategory('${c.name}', '${c.color}')">
                            ${c.icon} ${c.name}
                        </button>
                    `).join("")}
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Icon</label>
                <div class="icon-picker">
                    ${iconOptions.map(ic => `
                        <button class="icon-option ${formState.icon === ic ? "selected" : ""}"
                                onclick="window.selectIcon('${ic}')">${ic}</button>
                    `).join("")}
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Repeat Days</label>
                <div class="day-picker">
                    ${dayNumbers.map((d, i) => `
                        <button class="day-btn ${formState.targetDays.includes(d) ? "selected" : ""}"
                                onclick="window.toggleDay('${d}')">${dayNames[i]}</button>
                    `).join("")}
                </div>
            </div>

            <button class="btn-primary" onclick="window.saveHabit()">
                ${isEditing ? "Save Changes" : "Create Habit"}
            </button>

            ${isEditing ? `
                <button class="btn-danger" onclick="window.deleteHabit(${editingHabit!.id})">
                    Delete Habit
                </button>
            ` : ""}
        </div>
    </div>`;
}

// ── Data Loading ──

async function loadToday() {
    try {
        todayData = await window.lumina.send("habits/today") as TodayData;
        render();
    } catch (e) { console.error("Error loading today:", e); }
}

async function loadStats() {
    try {
        statsData = await window.lumina.send("habits/stats",
            JSON.stringify({ period: statsPeriod })) as StatsData;
        render();
    } catch (e) { console.error("Error loading stats:", e); }
}

async function loadHabits() {
    try {
        allHabits = await window.lumina.send("habits/list") as Habit[];
        render();
    } catch (e) { console.error("Error loading habits:", e); }
}

async function loadCategories() {
    try {
        categories = await window.lumina.send("habits/categories") as Category[];
    } catch (e) { console.error("Error loading categories:", e); }
}

// ── Actions ──

async function toggleHabit(id: number) {
    // Optimistic update
    if (todayData) {
        const habit = todayData.habits.find(h => h.id === id);
        if (habit) {
            habit.completed = !habit.completed;
            todayData.completedCount += habit.completed ? 1 : -1;
            render();
        }
    }
    try {
        await window.lumina.send("habits/toggle", JSON.stringify({ id }));
        await loadToday();
    } catch (e) {
        console.error("Error toggling:", e);
        await loadToday();
    }
}

function switchTab(tab: string) {
    currentTab = tab;
    if (tab === "today") loadToday();
    else if (tab === "stats") loadStats();
    else if (tab === "habits") loadHabits();
    else render();
}

function openAddHabit() {
    editingHabit = null;
    formState = { name: "", category: "general", color: "#6b7280", icon: "\u2B50", targetDays: "1234567" };
    modalOpen = true;
    render();
    setTimeout(() => {
        const input = document.getElementById("habit-name") as HTMLInputElement;
        if (input) input.focus();
    }, 350);
}

function openEditHabit(id: number) {
    const habit = allHabits.find(h => h.id === id);
    if (!habit) return;
    editingHabit = habit;
    formState = {
        name: habit.name,
        category: habit.category,
        color: habit.color,
        icon: habit.icon,
        targetDays: habit.targetDays || "1234567",
    };
    modalOpen = true;
    render();
}

async function saveHabit() {
    const nameInput = document.getElementById("habit-name") as HTMLInputElement;
    if (nameInput) formState.name = nameInput.value;

    if (!formState.name.trim()) return;
    if (!formState.targetDays) return;

    const payload = JSON.stringify({
        id: editingHabit?.id,
        name: formState.name.trim(),
        category: formState.category,
        color: formState.color,
        icon: formState.icon,
        targetDays: formState.targetDays,
    });

    try {
        if (editingHabit) {
            await window.lumina.send("habits/update", payload);
        } else {
            await window.lumina.send("habits/create", payload);
        }
        modalOpen = false;
        editingHabit = null;
        await Promise.all([loadToday(), loadHabits()]);
    } catch (e) {
        console.error("Error saving:", e);
    }
}

async function deleteHabit(id: number) {
    try {
        await window.lumina.send("habits/delete", JSON.stringify({ id }));
        modalOpen = false;
        editingHabit = null;
        await Promise.all([loadToday(), loadHabits()]);
    } catch (e) {
        console.error("Error deleting:", e);
    }
}

function closeModal() {
    modalOpen = false;
    editingHabit = null;
    render();
}

function setStatsPeriod(period: string) {
    statsPeriod = period;
    loadStats();
}

function selectCategory(cat: string, color: string) {
    formState.category = cat;
    formState.color = color;
    // Re-render only the modal
    const overlay = document.querySelector(".modal-overlay");
    if (overlay) {
        overlay.outerHTML = renderModal();
        const nameInput = document.getElementById("habit-name") as HTMLInputElement;
        if (nameInput) nameInput.value = formState.name;
    }
}

function selectIcon(icon: string) {
    formState.icon = icon;
    const overlay = document.querySelector(".modal-overlay");
    if (overlay) {
        overlay.outerHTML = renderModal();
        const nameInput = document.getElementById("habit-name") as HTMLInputElement;
        if (nameInput) nameInput.value = formState.name;
    }
}

function toggleDay(day: string) {
    if (formState.targetDays.includes(day)) {
        formState.targetDays = formState.targetDays.replace(day, "");
    } else {
        formState.targetDays = (formState.targetDays + day).split("").sort().join("");
    }
    const overlay = document.querySelector(".modal-overlay");
    if (overlay) {
        overlay.outerHTML = renderModal();
        const nameInput = document.getElementById("habit-name") as HTMLInputElement;
        if (nameInput) nameInput.value = formState.name;
    }
}

// ── Utilities ──

function formatDate(dateStr: string): string {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("en-US", {
        weekday: "long", month: "short", day: "numeric",
    });
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Window Exports ──

window.switchTab = switchTab;
window.toggleHabit = toggleHabit;
window.openAddHabit = openAddHabit;
window.openEditHabit = openEditHabit;
window.saveHabit = saveHabit;
window.deleteHabit = deleteHabit;
window.closeModal = closeModal;
window.setStatsPeriod = setStatsPeriod;
window.selectCategory = selectCategory;
window.selectIcon = selectIcon;
window.toggleDay = toggleDay;

// ── Init ──

loadCategories().then(() => loadToday());

export {};
