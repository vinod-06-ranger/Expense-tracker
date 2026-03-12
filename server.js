// HostelBuddy Backend Server
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Initialize SQLite Database
const db = new Database('expenses.db');

// Create tables
db.exec(`
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

// Prepared statements for better performance
const stmts = {
    getAllExpenses: db.prepare('SELECT * FROM expenses ORDER BY date DESC, created_at DESC'),
    getExpenseById: db.prepare('SELECT * FROM expenses WHERE id = ?'),
    insertExpense: db.prepare('INSERT INTO expenses (id, amount, description, category, date, note) VALUES (?, ?, ?, ?, ?, ?)'),
    updateExpense: db.prepare('UPDATE expenses SET amount = ?, description = ?, category = ?, date = ?, note = ? WHERE id = ?'),
    deleteExpense: db.prepare('DELETE FROM expenses WHERE id = ?'),
    getBudget: db.prepare('SELECT * FROM budget WHERE id = 1'),
    updateBudget: db.prepare('UPDATE budget SET monthly = ?, categories = ? WHERE id = 1')
};

// API Routes

// Get all expenses
app.get('/api/expenses', (req, res) => {
    try {
        const expenses = stmts.getAllExpenses.all();
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add new expense
app.post('/api/expenses', (req, res) => {
    try {
        const { id, amount, description, category, date, note } = req.body;
        stmts.insertExpense.run(id, amount, description, category, date, note || '');
        res.status(201).json({ success: true, id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update expense
app.put('/api/expenses/:id', (req, res) => {
    try {
        const { amount, description, category, date, note } = req.body;
        const result = stmts.updateExpense.run(amount, description, category, date, note || '', req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete expense
app.delete('/api/expenses/:id', (req, res) => {
    try {
        const result = stmts.deleteExpense.run(req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get budget
app.get('/api/budget', (req, res) => {
    try {
        const budget = stmts.getBudget.get();
        res.json({
            monthly: budget.monthly,
            categories: JSON.parse(budget.categories)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update budget
app.put('/api/budget', (req, res) => {
    try {
        const { monthly, categories } = req.body;
        stmts.updateBudget.run(monthly, JSON.stringify(categories || {}));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 HostelBuddy server running at http://localhost:${PORT}`);
    console.log(`📊 Database: expenses.db`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close();
    process.exit();
});
