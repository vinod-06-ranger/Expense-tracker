require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

const app       = express();
const PORT      = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Data Helpers ──────────────────────────────────────────────

function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        const defaultData = { users: [], sessions: [], expenses: {}, budgets: {}, debts: {} };
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!data.users)    data.users    = [];
    if (!data.sessions) data.sessions = [];
    if (!Array.isArray(data.expenses)) data.expenses = {};
    if (!Array.isArray(data.budgets))  data.budgets  = {};
    if (!Array.isArray(data.debts))    data.debts    = {};
    return data;
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const SALT = process.env.PASSWORD_SALT || 'hostelbuddy_salt_2024';

function hashPassword(password) {
    return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ── Auth Middleware ───────────────────────────────────────────

function requireAuth(req, res, next) {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token   = auth.split(' ')[1];
    const data    = loadData();
    const session = data.sessions.find(s => s.token === token);
    if (!session) return res.status(401).json({ error: 'Session expired or invalid' });
    req.userId = session.userId;
    next();
}

// ── Auth Routes ───────────────────────────────────────────────

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)  return res.status(400).json({ error: 'Username and password required' });
    if (username.length < 3)     return res.status(400).json({ error: 'Username must be at least 3 characters' });
    if (password.length < 4)     return res.status(400).json({ error: 'Password must be at least 4 characters' });
    const data = loadData();
    if (data.users.find(u => u.username === username)) return res.status(409).json({ error: 'Username already taken' });
    const userId = Date.now().toString();
    data.users.push({ userId, username, passwordHash: hashPassword(password) });
    const token = generateToken();
    data.sessions.push({ token, userId });
    saveData(data);
    res.json({ token, username });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const data = loadData();
    const user = data.users.find(u => u.username === username);
    if (!user || user.passwordHash !== hashPassword(password)) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }
    const token = generateToken();
    data.sessions.push({ token, userId: user.userId });
    saveData(data);
    res.json({ token, username });
});

app.post('/api/logout', requireAuth, (req, res) => {
    const token = req.headers['authorization'].split(' ')[1];
    const data  = loadData();
    data.sessions = data.sessions.filter(s => s.token !== token);
    saveData(data);
    res.json({ success: true });
});

// ── Expenses ──────────────────────────────────────────────────

app.get('/api/expenses', requireAuth, (req, res) => {
    const data = loadData();
    res.json(data.expenses[req.userId] || []);
});

app.post('/api/expenses', requireAuth, (req, res) => {
    const data = loadData();
    if (!data.expenses[req.userId]) data.expenses[req.userId] = [];
    data.expenses[req.userId].unshift(req.body);
    saveData(data);
    res.json(req.body);
});

app.put('/api/expenses/:id', requireAuth, (req, res) => {
    const data = loadData();
    const list = data.expenses[req.userId] || [];
    const idx  = list.findIndex(e => e.id === req.params.id);
    if (idx !== -1) list[idx] = req.body;
    data.expenses[req.userId] = list;
    saveData(data);
    res.json({ success: true });
});

app.delete('/api/expenses/:id', requireAuth, (req, res) => {
    const data = loadData();
    data.expenses[req.userId] = (data.expenses[req.userId] || []).filter(e => e.id !== req.params.id);
    saveData(data);
    res.json({ success: true });
});

// ── Budget ────────────────────────────────────────────────────

app.get('/api/budget', requireAuth, (req, res) => {
    const data = loadData();
    res.json(data.budgets[req.userId] || { monthly: 10000, categories: {} });
});

app.put('/api/budget', requireAuth, (req, res) => {
    const data = loadData();
    data.budgets[req.userId] = req.body;
    saveData(data);
    res.json({ success: true });
});

// ── Debts ─────────────────────────────────────────────────────

app.get('/api/debts', requireAuth, (req, res) => {
    const data = loadData();
    res.json(data.debts[req.userId] || []);
});

app.post('/api/debts', requireAuth, (req, res) => {
    const data = loadData();
    if (!data.debts[req.userId]) data.debts[req.userId] = [];
    data.debts[req.userId].unshift(req.body);
    saveData(data);
    res.json({ success: true });
});

app.put('/api/debts/:id', requireAuth, (req, res) => {
    const data = loadData();
    const list = data.debts[req.userId] || [];
    const idx  = list.findIndex(d => d.id === req.params.id);
    if (idx !== -1) list[idx] = req.body;
    data.debts[req.userId] = list;
    saveData(data);
    res.json({ success: true });
});

app.delete('/api/debts/:id', requireAuth, (req, res) => {
    const data = loadData();
    data.debts[req.userId] = (data.debts[req.userId] || []).filter(d => d.id !== req.params.id);
    saveData(data);
    res.json({ success: true });
});

// ── Gemini AI Chat ────────────────────────────────────────────

app.post('/api/chat', requireAuth, async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        return res.status(503).json({ error: 'Gemini API key not configured.' });
    }
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ error: 'No message provided' });

    const today = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });
    const systemPrompt = `You are BuddyBot, a friendly AI financial assistant inside the HostelBuddy expense tracker.
Today is ${today}.
User data: Budget ₹${context?.budget?.monthly}, Spent ₹${context?.totalSpent}, Remaining ₹${context?.budgetLeft}, ${context?.transactionCount} transactions, Daily avg ₹${context?.dailyAvg}.
Categories: ${context?.categoryBreakdown ? Object.entries(context.categoryBreakdown).map(([k,v]) => `${k}:₹${v}`).join(', ') : 'none'}.
Recent: ${context?.recentExpenses?.slice(0,3).map(e => `${e.description}(₹${e.amount})`).join(', ') || 'none'}.
Debts: Owe ₹${context?.totalOwe}, Owed ₹${context?.totalOwed}.
Answer in 2-3 short friendly sentences using actual rupee amounts.`;

    try {
        const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemPrompt}\n\nUser: ${message}` }] }],
                    generationConfig: { maxOutputTokens: 200, temperature: 0.7 }
                })
            }
        );
        const d = await r.json();
        if (!r.ok) return res.status(502).json({ error: d?.error?.message || 'Gemini error' });
        res.json({ reply: d?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to reach Gemini API.' });
    }
});

// ── Pages ─────────────────────────────────────────────────────

app.get('/login.html',    (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/',              (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`🚀 HostelBuddy running at http://localhost:${PORT}`));
