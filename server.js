const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Data Helpers ─────────────────────────────────────────────

function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        const defaultData = { users: [], sessions: [], expenses: {}, budgets: {}, debts: {} };
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    // Migrate old format if needed
    if (!data.users) data.users = [];
    if (!data.sessions) data.sessions = [];
    if (!data.expenses || Array.isArray(data.expenses)) data.expenses = {};
    if (!data.budgets || Array.isArray(data.budgets)) data.budgets = {};
    if (!data.debts || Array.isArray(data.debts)) data.debts = {};
    return data;
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password + 'hostelbuddy_salt').digest('hex');
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ── Auth Middleware ───────────────────────────────────────────

function requireAuth(req, res, next) {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const data = loadData();
    const session = data.sessions.find(s => s.token === token && new Date(s.expires) > new Date());
    if (!session) return res.status(401).json({ error: 'Invalid or expired token' });

    req.userId = session.userId;
    req.username = session.username;
    next();
}

// ── Auth Routes ───────────────────────────────────────────────

app.post('/api/register', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

        const data = loadData();
        if (data.users.find(u => u.username === username.toLowerCase())) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        const userId = Date.now().toString();
        data.users.push({ id: userId, username: username.toLowerCase(), passwordHash: hashPassword(password) });

        // Default budget for new user
        data.budgets[userId] = { monthly: 10000, categories: {} };
        data.expenses[userId] = [];
        data.debts[userId] = [];
        saveData(data);

        const token = generateToken();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
        data.sessions.push({ token, userId, username: username.toLowerCase(), expires });
        saveData(data);

        res.status(201).json({ token, username: username.toLowerCase(), userId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const data = loadData();
        const user = data.users.find(u => u.username === username?.toLowerCase() && u.passwordHash === hashPassword(password));
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });

        const token = generateToken();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        // Remove old sessions for this user
        data.sessions = data.sessions.filter(s => s.userId !== user.id);
        data.sessions.push({ token, userId: user.id, username: user.username, expires });
        saveData(data);

        res.json({ token, username: user.username, userId: user.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/logout', requireAuth, (req, res) => {
    const data = loadData();
    const token = req.headers['authorization']?.replace('Bearer ', '');
    data.sessions = data.sessions.filter(s => s.token !== token);
    saveData(data);
    res.json({ success: true });
});

// ── Expense Routes ────────────────────────────────────────────

app.get('/api/expenses', requireAuth, (req, res) => {
    const data = loadData();
    res.json(data.expenses[req.userId] || []);
});

app.post('/api/expenses', requireAuth, (req, res) => {
    const data = loadData();
    if (!data.expenses[req.userId]) data.expenses[req.userId] = [];
    data.expenses[req.userId].unshift(req.body);
    saveData(data);
    res.status(201).json({ success: true });
});

app.put('/api/expenses/:id', requireAuth, (req, res) => {
    const data = loadData();
    const list = data.expenses[req.userId] || [];
    const idx = list.findIndex(e => e.id === req.params.id);
    if (idx !== -1) { list[idx] = req.body; saveData(data); res.json({ success: true }); }
    else res.status(404).json({ error: 'Not found' });
});

app.delete('/api/expenses/:id', requireAuth, (req, res) => {
    const data = loadData();
    data.expenses[req.userId] = (data.expenses[req.userId] || []).filter(e => e.id !== req.params.id);
    saveData(data);
    res.json({ success: true });
});

// ── Budget Routes ─────────────────────────────────────────────

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

// ── Debt Routes ───────────────────────────────────────────────

app.get('/api/debts', requireAuth, (req, res) => {
    const data = loadData();
    res.json(data.debts[req.userId] || []);
});

app.post('/api/debts', requireAuth, (req, res) => {
    const data = loadData();
    if (!data.debts[req.userId]) data.debts[req.userId] = [];
    data.debts[req.userId].unshift(req.body);
    saveData(data);
    res.status(201).json({ success: true });
});

app.put('/api/debts/:id', requireAuth, (req, res) => {
    const data = loadData();
    const list = data.debts[req.userId] || [];
    const idx = list.findIndex(d => d.id === req.params.id);
    if (idx !== -1) { list[idx] = req.body; saveData(data); res.json({ success: true }); }
    else res.status(404).json({ error: 'Not found' });
});

app.delete('/api/debts/:id', requireAuth, (req, res) => {
    const data = loadData();
    data.debts[req.userId] = (data.debts[req.userId] || []).filter(d => d.id !== req.params.id);
    saveData(data);
    res.json({ success: true });
});

app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
    console.log(`🚀 HostelBuddy running at http://localhost:${PORT}`);
});
