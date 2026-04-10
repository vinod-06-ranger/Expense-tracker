<<<<<<< HEAD
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const crypto     = require('crypto');
const bcrypt     = require('bcryptjs');
const Database   = require('better-sqlite3');

const app      = express();
const PORT     = process.env.PORT || 3000;
const DB_FILE  = path.join(__dirname, 'hostelbuddy.db');

// ── SQLite Setup ──────────────────────────────────────────────

const db = new Database(DB_FILE);

db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        username      TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
        token    TEXT PRIMARY KEY,
        user_id  TEXT NOT NULL,
        username TEXT NOT NULL,
        expires  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        amount      REAL NOT NULL,
        description TEXT,
        category    TEXT,
        date        TEXT,
        note        TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS budgets (
        user_id    TEXT PRIMARY KEY,
        monthly    REAL DEFAULT 10000,
        categories TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS debts (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        person      TEXT,
        amount      REAL,
        type        TEXT,
        description TEXT DEFAULT '',
        date        TEXT
    );
`);

// ── Middleware ────────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Helpers ───────────────────────────────────────────────────

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ── Auth Middleware ───────────────────────────────────────────

function requireAuth(req, res, next) {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const session = db.prepare(
        'SELECT * FROM sessions WHERE token = ? AND expires > ?'
    ).get(token, new Date().toISOString());

    if (!session) return res.status(401).json({ error: 'Invalid or expired token' });

    req.userId   = session.user_id;
    req.username = session.username;
    next();
}

// ── Auth Routes ───────────────────────────────────────────────

app.post('/api/register', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ error: 'Username and password required' });

        const existing = db.prepare('SELECT id FROM users WHERE username = ?')
            .get(username.toLowerCase());
        if (existing)
            return res.status(409).json({ error: 'Username already taken' });

        const userId      = Date.now().toString();
        const passwordHash = bcrypt.hashSync(password, 10);   // Bug 1 fix: bcrypt

        db.prepare(
            'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)'
        ).run(userId, username.toLowerCase(), passwordHash);

        // Default budget row
        db.prepare(
            'INSERT INTO budgets (user_id, monthly, categories) VALUES (?, ?, ?)'
        ).run(userId, 10000, '{}');

        const token   = generateToken();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        db.prepare(
            'INSERT INTO sessions (token, user_id, username, expires) VALUES (?, ?, ?, ?)'
        ).run(token, userId, username.toLowerCase(), expires);

        res.status(201).json({ token, username: username.toLowerCase(), userId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const user = db.prepare('SELECT * FROM users WHERE username = ?')
            .get(username?.toLowerCase());

        if (!user || !bcrypt.compareSync(password, user.password_hash))   // Bug 1 fix: bcrypt compare
            return res.status(401).json({ error: 'Invalid username or password' });

        const token   = generateToken();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // Remove old sessions for this user, then insert new one
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
        db.prepare(
            'INSERT INTO sessions (token, user_id, username, expires) VALUES (?, ?, ?, ?)'
        ).run(token, user.id, user.username, expires);

        res.json({ token, username: user.username, userId: user.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/logout', requireAuth, (req, res) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.json({ success: true });
});

// ── Expense Routes ────────────────────────────────────────────

app.get('/api/expenses', requireAuth, (req, res) => {
    const rows = db.prepare(
        'SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC'
    ).all(req.userId);
    res.json(rows);
});

app.post('/api/expenses', requireAuth, (req, res) => {
    const { id, amount, description, category, date, note } = req.body;
    db.prepare(
        'INSERT INTO expenses (id, user_id, amount, description, category, date, note) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, req.userId, amount, description, category, date, note || '');
    res.status(201).json({ success: true });
});

app.put('/api/expenses/:id', requireAuth, (req, res) => {
    const { amount, description, category, date, note } = req.body;
    const result = db.prepare(
        'UPDATE expenses SET amount = ?, description = ?, category = ?, date = ?, note = ? WHERE id = ? AND user_id = ?'
    ).run(amount, description, category, date, note || '', req.params.id, req.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
});

app.delete('/api/expenses/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?')
        .run(req.params.id, req.userId);
    res.json({ success: true });
});

// ── Budget Routes ─────────────────────────────────────────────

app.get('/api/budget', requireAuth, (req, res) => {
    const row = db.prepare('SELECT * FROM budgets WHERE user_id = ?').get(req.userId);
    if (!row) return res.json({ monthly: 10000, categories: {} });
    res.json({ monthly: row.monthly, categories: JSON.parse(row.categories || '{}') });
});

app.put('/api/budget', requireAuth, (req, res) => {
    const { monthly, categories } = req.body;
    db.prepare(
        'INSERT OR REPLACE INTO budgets (user_id, monthly, categories) VALUES (?, ?, ?)'
    ).run(req.userId, monthly, JSON.stringify(categories || {}));
    res.json({ success: true });
});

// ── Debt Routes ───────────────────────────────────────────────

app.get('/api/debts', requireAuth, (req, res) => {
    const rows = db.prepare(
        'SELECT * FROM debts WHERE user_id = ? ORDER BY date DESC'
    ).all(req.userId);
    res.json(rows);
});

app.post('/api/debts', requireAuth, (req, res) => {
    const { id, person, amount, type, description, date } = req.body;
    db.prepare(
        'INSERT INTO debts (id, user_id, person, amount, type, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, req.userId, person, amount, type, description || '', date);
    res.status(201).json({ success: true });
});

app.put('/api/debts/:id', requireAuth, (req, res) => {
    const { person, amount, type, description, date } = req.body;
    const result = db.prepare(
        'UPDATE debts SET person = ?, amount = ?, type = ?, description = ?, date = ? WHERE id = ? AND user_id = ?'
    ).run(person, amount, type, description || '', date, req.params.id, req.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
});

app.delete('/api/debts/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM debts WHERE id = ? AND user_id = ?')
        .run(req.params.id, req.userId);
    res.json({ success: true });
});

// ── Gemini AI Chat ────────────────────────────────────────────

app.post('/api/chat', requireAuth, async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        return res.status(503).json({ error: 'Gemini API key not configured. Add it to your .env file.' });
    }

    const { message, context } = req.body;
    if (!message) return res.status(400).json({ error: 'No message provided' });

    const today = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });
    const systemPrompt = `You are BuddyBot, a friendly AI financial assistant inside the HostelBuddy expense tracker app.
Today is ${today}.

Here is the user's current financial data:
- Monthly Budget: ₹${context?.budget?.monthly ?? 'N/A'}
- Total Spent This Month: ₹${context?.totalSpent ?? 0}
- Budget Remaining: ₹${context?.budgetLeft ?? 0}
- Number of Transactions: ${context?.transactionCount ?? 0}
- Daily Average Spending: ₹${context?.dailyAvg ?? 0}

Category-wise spending this month:
${context?.categoryBreakdown ? Object.entries(context.categoryBreakdown).map(([cat, amt]) => `  - ${cat}: ₹${amt}`).join('\n') : '  No data'}

Recent transactions:
${context?.recentExpenses?.slice(0, 5).map(e => `  - ${e.date}: ${e.description} (${e.category}) — ₹${e.amount}`).join('\n') || '  No recent transactions'}

Debts:
- You owe: ₹${context?.totalOwe ?? 0}
- Owed to you: ₹${context?.totalOwed ?? 0}

Please answer the user's question in 2-3 short sentences. Be specific with rupee amounts from their data. Use a friendly, encouraging tone. Keep it concise.`;

    try {
        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemPrompt}\n\nUser: ${message}` }] }],
                    generationConfig: { maxOutputTokens: 256, temperature: 0.7 }
                })
            }
        );
        const data = await geminiRes.json();
        if (!geminiRes.ok) {
            console.error('Gemini error:', data);
            return res.status(502).json({ error: data?.error?.message || 'Gemini API error' });
        }
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
        res.json({ reply });
    } catch (err) {
        console.error('Chat error:', err);
        res.status(500).json({ error: 'Failed to reach Gemini API.' });
    }
});

// ── Static Pages ──────────────────────────────────────────────

app.get('/login.html',    (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/',              (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
    console.log(`🚀 HostelBuddy running at http://localhost:${PORT}`);
    console.log(`📦 Database: ${DB_FILE}`);
});
=======
// HostelBuddy Backend Server
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'expenses.db');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

let db; // sql.js Database instance

// Persist DB to disk
function saveDb() {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Initialize SQLite via sql.js (pure WebAssembly, no native build tools required)
async function initDb() {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS expenses (
            id TEXT PRIMARY KEY,
            amount REAL NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            date TEXT NOT NULL,
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS budget (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            monthly REAL DEFAULT 10000,
            categories TEXT DEFAULT '{}'
        );

        INSERT OR IGNORE INTO budget (id, monthly, categories) VALUES (1, 10000, '{}');
    `);

    saveDb();
    console.log('📦 SQLite database initialised (sql.js)');
}

// Helper: execute a query and return all rows as objects
function queryAll(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

// Helper: execute a statement (INSERT / UPDATE / DELETE)
function run(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.run(params);
    stmt.free();
    saveDb();
}

// ── API Routes ──────────────────────────────────────────────

// GET all expenses
app.get('/api/expenses', (req, res) => {
    try {
        const expenses = queryAll('SELECT * FROM expenses ORDER BY date DESC, created_at DESC');
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST new expense
app.post('/api/expenses', (req, res) => {
    try {
        const { id, amount, description, category, date, note } = req.body;
        run(
            'INSERT INTO expenses (id, amount, description, category, date, note) VALUES (?, ?, ?, ?, ?, ?)',
            [id, amount, description, category, date, note || '']
        );
        res.status(201).json({ success: true, id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT update expense
app.put('/api/expenses/:id', (req, res) => {
    try {
        const { amount, description, category, date, note } = req.body;
        run(
            'UPDATE expenses SET amount = ?, description = ?, category = ?, date = ?, note = ? WHERE id = ?',
            [amount, description, category, date, note || '', req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE expense
app.delete('/api/expenses/:id', (req, res) => {
    try {
        run('DELETE FROM expenses WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET budget
app.get('/api/budget', (req, res) => {
    try {
        const rows = queryAll('SELECT * FROM budget WHERE id = 1');
        const budget = rows[0];
        res.json({
            monthly: budget.monthly,
            categories: JSON.parse(budget.categories)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT update budget
app.put('/api/budget', (req, res) => {
    try {
        const { monthly, categories } = req.body;
        run(
            'UPDATE budget SET monthly = ?, categories = ? WHERE id = 1',
            [monthly, JSON.stringify(categories || {})]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ───────────────────────────────────────────────────
initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 HostelBuddy server running at http://localhost:${PORT}`);
        console.log(`📊 Database: expenses.db`);
    });
}).catch(err => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    if (db) saveDb();
    process.exit();
});
>>>>>>> 14a969111c9f3609d8feb846f2bbd368cab6a688
