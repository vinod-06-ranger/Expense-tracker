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
