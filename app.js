// HostelBuddy - Phase 2: Auth + Notifications + Chatbot + Budget Fix

class ExpenseTracker {
    constructor() {
        this.expenses = [];
        this.budget = { monthly: 10000, categories: {} };
        this.profile = JSON.parse(localStorage.getItem('profile')) || { name: 'Hostler', room: 'Room 404', email: '', phone: '' };
        this.debts = [];
        this.token = localStorage.getItem('hb_token') || null;
        this.username = localStorage.getItem('hb_username') || null;
        this.notifications = JSON.parse(localStorage.getItem('hb_notifs')) || [];
        this.categoryConfig = {
            food:          { icon: 'ðŸ”', color: '#FF6B6B', name: 'Food' },
            transport:     { icon: 'ðŸšŒ', color: '#4ECDC4', name: 'Transport' },
            utilities:     { icon: 'ðŸ’¡', color: '#FFE66D', name: 'Utilities' },
            entertainment: { icon: 'ðŸŽ®', color: '#A855F7', name: 'Entertainment' },
            shopping:      { icon: 'ðŸ›’', color: '#22D3EE', name: 'Shopping' },
            health:        { icon: 'ðŸ’Š', color: '#F472B6', name: 'Health' },
            other:         { icon: 'ðŸ“¦', color: '#94A3B8', name: 'Other' }
        };
        this.charts = {};
        this.apiBase = '/api';
        this.init();
    }

    async init() {
        if (this.token) {
            this.showApp();
        } else {
            this.showAuth();
        }
    }

    // â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    showAuth() {
        document.getElementById('authOverlay').classList.remove('hidden');
        document.getElementById('appContainer').classList.add('hidden');
        this.bindAuthEvents();
    }

    showApp() {
        document.getElementById('authOverlay').classList.add('hidden');
        document.getElementById('appContainer').classList.remove('hidden');
        this.bindEvents();
        this.setCurrentDate();
        this.loadAll();
        this.requestNotificationPermission();
    }

    bindAuthEvents() {
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.remove('hidden');
        });
        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
        });
        document.getElementById('loginBtn').addEventListener('click', () => this.handleLogin());
        document.getElementById('registerBtn').addEventListener('click', () => this.handleRegister());
        document.getElementById('loginPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleLogin(); });
        document.getElementById('registerConfirm').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleRegister(); });
    }

    async handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errEl = document.getElementById('loginError');
        errEl.classList.add('hidden');
        if (!username || !password) { errEl.textContent = 'Please fill all fields.'; errEl.classList.remove('hidden'); return; }
        try {
            const res = await fetch(`${this.apiBase}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) { errEl.textContent = data.error || 'Login failed.'; errEl.classList.remove('hidden'); return; }
            this.token = data.token;
            this.username = data.username;
            localStorage.setItem('hb_token', data.token);
            localStorage.setItem('hb_username', data.username);
            this.showApp();
        } catch (e) {
            errEl.textContent = 'Server error. Is the server running?'; errEl.classList.remove('hidden');
        }
    }

    async handleRegister() {
        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirm = document.getElementById('registerConfirm').value;
        const errEl = document.getElementById('registerError');
        errEl.classList.add('hidden');
        if (!username || !password) { errEl.textContent = 'Please fill all fields.'; errEl.classList.remove('hidden'); return; }
        if (password !== confirm) { errEl.textContent = 'Passwords do not match.'; errEl.classList.remove('hidden'); return; }
        if (password.length < 4) { errEl.textContent = 'Password must be at least 4 characters.'; errEl.classList.remove('hidden'); return; }
        try {
            const res = await fetch(`${this.apiBase}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) { errEl.textContent = data.error || 'Registration failed.'; errEl.classList.remove('hidden'); return; }
            this.token = data.token;
            this.username = data.username;
            localStorage.setItem('hb_token', data.token);
            localStorage.setItem('hb_username', data.username);
            this.showApp();
            this.showToast(`Welcome to HostelBuddy, ${username}! ðŸŽ‰`, 'success');
        } catch (e) {
            errEl.textContent = 'Server error. Is the server running?'; errEl.classList.remove('hidden');
        }
    }

    async handleLogout() {
        try { await this.apiFetch('/logout', { method: 'POST' }); } catch (_) {}
        localStorage.removeItem('hb_token');
        localStorage.removeItem('hb_username');
        window.location.href = '/login.html';
    }

    // â”€â”€ API Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    async apiFetch(path, options = {}) {
        const res = await fetch(`${this.apiBase}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                ...(options.headers || {})
            },
            body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined
        });
        if (res.status === 401) { this.handleLogout(); throw new Error('Unauthorized'); }
        return res;
    }

    async loadAll() {
        try {
            const [expRes, budRes, debRes] = await Promise.all([
                this.apiFetch('/expenses'),
                this.apiFetch('/budget'),
                this.apiFetch('/debts')
            ]);
            this.expenses = await expRes.json();
            this.budget   = await budRes.json();
            this.debts    = await debRes.json();
        } catch (e) {
            console.warn('API load failed, using empty state.');
        }
        this.updateDashboard();
        this.renderExpenses();
        this.renderBudget();
        this.renderAnalytics();
        this.renderProfile();
        this.renderDebts();
        this.renderNotifications();
        this.initCharts();
    }

    // â”€â”€ UI Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item =>
            item.addEventListener('click', (e) => this.handleNavigation(e))
        );
        document.querySelectorAll('.view-all').forEach(item =>
            item.addEventListener('click', (e) => this.handleNavigation(e))
        );
        document.querySelector('.user-profile[data-section="profile"]').addEventListener('click', () =>
            this.navigateToSection('profile')
        );

        // Mobile menu
        document.getElementById('menuToggle').addEventListener('click', () =>
            document.getElementById('sidebar').classList.toggle('active')
        );

        // Expense modal
        document.getElementById('addExpenseBtn').addEventListener('click', () => this.openExpenseModal());
        document.getElementById('fabAddExpense').addEventListener('click', () => this.openExpenseModal());
        document.getElementById('closeModal').addEventListener('click', () => this.closeExpenseModal());
        document.getElementById('cancelExpense').addEventListener('click', () => this.closeExpenseModal());
        document.getElementById('expenseForm').addEventListener('submit', (e) => this.handleExpenseSubmit(e));

        // Split checkbox
        document.getElementById('splitExpense').addEventListener('change', (e) =>
            document.getElementById('splitOptions').classList.toggle('active', e.target.checked)
        );

        // Budget modal
        document.getElementById('editBudgetBtn').addEventListener('click', () => this.openBudgetModal());
        document.getElementById('closeBudgetModal').addEventListener('click', () => this.closeBudgetModal());
        document.getElementById('cancelBudget').addEventListener('click', () => this.closeBudgetModal());
        document.getElementById('budgetForm').addEventListener('submit', (e) => this.handleBudgetSubmit(e));

        // Filters
        document.getElementById('searchExpense').addEventListener('input', () => this.filterExpenses());
        document.getElementById('categoryFilter').addEventListener('change', () => this.filterExpenses());

        // Excel export
        document.getElementById('exportExcelBtn').addEventListener('click', () => this.exportToExcel());

        // Profile
        document.getElementById('editProfileBtn').addEventListener('click', () => this.toggleProfileForm(true));
        document.getElementById('cancelProfileBtn').addEventListener('click', () => this.toggleProfileForm(false));
        document.getElementById('saveProfileBtn').addEventListener('click', () => this.saveProfile());

        // Debt modal
        document.getElementById('addDebtBtn').addEventListener('click', () => this.openDebtModal());
        document.getElementById('closeDebtModal').addEventListener('click', () => this.closeDebtModal());
        document.getElementById('cancelDebt').addEventListener('click', () => this.closeDebtModal());
        document.getElementById('debtForm').addEventListener('submit', (e) => this.handleDebtSubmit(e));

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

        // Notifications
        document.getElementById('notifBtn').addEventListener('click', () =>
            document.getElementById('notifDropdown').classList.toggle('hidden')
        );
        document.getElementById('clearNotifs').addEventListener('click', () => this.clearNotifications());
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notification-wrapper')) {
                document.getElementById('notifDropdown').classList.add('hidden');
            }
        });

        // Chatbot
        document.getElementById('chatbotToggle').addEventListener('click', () =>
            document.getElementById('chatbotWidget').classList.toggle('open')
        );
        document.getElementById('chatbotClose').addEventListener('click', () =>
            document.getElementById('chatbotWidget').classList.remove('open')
        );
        document.getElementById('chatbotSend').addEventListener('click', () => this.handleChatInput());
        document.getElementById('chatbotInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleChatInput();
        });

        // Modal overlays
        document.querySelectorAll('.modal-overlay').forEach(overlay =>
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.remove('active');
            })
        );
    }

    setCurrentDate() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-IN', options);
        document.getElementById('expenseDate').valueAsDate = new Date();
    }

    handleNavigation(e) {
        e.preventDefault();
        this.navigateToSection(e.currentTarget.dataset.section);
    }

    navigateToSection(section) {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
        if (navItem) navItem.classList.add('active');
        document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
        document.getElementById(section).classList.remove('hidden');
        document.getElementById('pageTitle').textContent = section.charAt(0).toUpperCase() + section.slice(1);
        document.getElementById('sidebar').classList.remove('active');
    }

    // â”€â”€ Expense Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    openExpenseModal(expense = null) {
        const modal = document.getElementById('expenseModal');
        document.getElementById('expenseForm').reset();
        document.getElementById('splitExpense').checked = false;
        document.getElementById('splitOptions').classList.remove('active');

        if (expense) {
            document.getElementById('modalTitle').textContent = 'Edit Expense';
            document.getElementById('expenseId').value = expense.id;
            document.getElementById('expenseAmount').value = expense.amount;
            document.getElementById('expenseDescription').value = expense.description;
            document.getElementById('expenseCategory').value = expense.category;
            document.getElementById('expenseDate').value = expense.date;
            document.getElementById('expenseNote').value = expense.note || '';
        } else {
            document.getElementById('modalTitle').textContent = 'Add Expense';
            document.getElementById('expenseId').value = '';
            document.getElementById('expenseDate').valueAsDate = new Date();
        }
        modal.classList.add('active');
    }

    closeExpenseModal() {
        document.getElementById('expenseModal').classList.remove('active');
    }

    async handleExpenseSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('expenseId').value;
        const expense = {
            id: id || Date.now().toString(),
            amount: parseFloat(document.getElementById('expenseAmount').value),
            description: document.getElementById('expenseDescription').value,
            category: document.getElementById('expenseCategory').value,
            date: document.getElementById('expenseDate').value,
            note: document.getElementById('expenseNote').value
        };

        if (id) {
            const idx = this.expenses.findIndex(e => e.id === id);
            this.expenses[idx] = expense;
            await this.apiFetch(`/expenses/${id}`, { method: 'PUT', body: expense });
            this.showToast('Expense updated!', 'success');
        } else {
            this.expenses.unshift(expense);
            await this.apiFetch('/expenses', { method: 'POST', body: expense });
            this.showToast('Expense added!', 'success');

            // Handle splitting
            if (document.getElementById('splitExpense').checked) {
                const count = parseInt(document.getElementById('splitCount').value) || 2;
                const person = document.getElementById('splitPerson').value || 'Roommate';
                if (count >= 2) {
                    const share = expense.amount / count;
                    const debt = {
                        id: Date.now().toString() + '-split',
                        person, amount: share, type: 'owed',
                        description: `Split for ${expense.description}`,
                        date: expense.date
                    };
                    this.debts.unshift(debt);
                    await this.apiFetch('/debts', { method: 'POST', body: debt });
                    this.renderDebts();
                    this.showToast(`â‚¹${share.toFixed(0)} split with ${person}`, 'info');
                }
            }
        }

        this.closeExpenseModal();
        this.updateDashboard();
        this.renderExpenses();
        this.renderBudget();
        this.renderAnalytics();
        this.updateCharts();
    }

    async deleteExpense(id) {
        if (!confirm('Delete this expense?')) return;
        this.expenses = this.expenses.filter(e => e.id !== id);
        await this.apiFetch(`/expenses/${id}`, { method: 'DELETE' });
        this.updateDashboard();
        this.renderExpenses();
        this.renderBudget();
        this.renderAnalytics();
        this.updateCharts();
        this.showToast('Expense deleted!', 'success');
    }

    // â”€â”€ Budget Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    openBudgetModal() {
        document.getElementById('monthlyBudget').value = this.budget.monthly;
        Object.keys(this.categoryConfig).forEach(cat => {
            const el = document.getElementById(`budget${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
            if (el) el.value = this.budget.categories[cat] || '';
        });
        document.getElementById('budgetModal').classList.add('active');
    }

    closeBudgetModal() {
        document.getElementById('budgetModal').classList.remove('active');
    }

    async handleBudgetSubmit(e) {
        e.preventDefault();
        this.budget.monthly = parseFloat(document.getElementById('monthlyBudget').value);
        Object.keys(this.categoryConfig).forEach(cat => {
            const el = document.getElementById(`budget${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
            if (el && el.value) this.budget.categories[cat] = parseFloat(el.value);
        });
        await this.apiFetch('/budget', { method: 'PUT', body: this.budget });
        this.closeBudgetModal();
        this.updateDashboard();
        this.renderBudget();
        this.showToast('Budget updated!', 'success');
    }

    // â”€â”€ Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    updateDashboard() {
        const now = new Date();
        const monthExpenses = this.expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        const totalSpent    = monthExpenses.reduce((s, e) => s + e.amount, 0);
        const budgetLeft    = this.budget.monthly - totalSpent;  // Can be negative (over budget)
        const isOverBudget  = budgetLeft < 0;
        const budgetPercent = this.budget.monthly > 0 ? Math.round(Math.abs(budgetLeft) / this.budget.monthly * 100) : 0;
        const dailyAvg      = totalSpent / Math.max(1, now.getDate());

        document.getElementById('totalSpent').textContent       = this.formatCurrency(totalSpent);
        document.getElementById('budgetLeft').textContent       = (isOverBudget ? '-' : '') + this.formatCurrency(Math.abs(budgetLeft));
        document.getElementById('transactionCount').textContent = monthExpenses.length;
        document.getElementById('dailyAverage').textContent     = this.formatCurrency(dailyAvg);

        const budgetCard = document.getElementById('budgetLeftCard');
        const pctEl      = document.getElementById('budgetPercent');
        if (isOverBudget) {
            budgetCard.classList.add('over-budget');
            pctEl.textContent = `${budgetPercent}% over budget`;
        } else {
            budgetCard.classList.remove('over-budget');
            pctEl.textContent = `${100 - budgetPercent}% remaining`;
        }

        // Trigger notifications
        const spentPercent = this.budget.monthly > 0 ? (totalSpent / this.budget.monthly) * 100 : 0;
        if (spentPercent >= 80 && spentPercent < 100) {
            this.addNotification('âš ï¸', `You've used ${Math.round(spentPercent)}% of your budget!`);
        }
        if (isOverBudget) {
            this.addNotification('ðŸš¨', `Over budget by ${this.formatCurrency(Math.abs(budgetLeft))}!`);
            this.pushBrowserNotification('Budget Alert! ðŸš¨', `You are over budget by ${this.formatCurrency(Math.abs(budgetLeft))}`);
        }

        this.renderRecentTransactions(monthExpenses.slice(0, 5));
    }

    renderRecentTransactions(transactions) {
        const container = document.getElementById('recentTransactions');
        if (transactions.length === 0) {
            container.innerHTML = '<div class="empty-state"><h4>No transactions yet</h4><p>Add your first expense!</p></div>';
            return;
        }
        container.innerHTML = transactions.map(t => `
            <div class="transaction-item">
                <div class="transaction-left">
                    <div class="transaction-icon ${t.category}">${this.categoryConfig[t.category]?.icon || 'ðŸ“¦'}</div>
                    <div class="transaction-info">
                        <h4>${t.description}</h4>
                        <p>${new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} â€¢ ${this.categoryConfig[t.category]?.name || 'Other'}</p>
                    </div>
                </div>
                <span class="transaction-amount">-${this.formatCurrency(t.amount)}</span>
            </div>
        `).join('');
    }

    // â”€â”€ Expenses Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    renderExpenses() { this.filterExpenses(); }

    filterExpenses() {
        const search   = document.getElementById('searchExpense').value.toLowerCase();
        const category = document.getElementById('categoryFilter').value;
        let filtered   = this.expenses;
        if (search) filtered = filtered.filter(e => e.description.toLowerCase().includes(search));
        if (category !== 'all') filtered = filtered.filter(e => e.category === category);

        const tbody = document.getElementById('expensesTableBody');
        const empty = document.getElementById('emptyExpenses');

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            tbody.innerHTML = filtered.map(e => `
                <tr>
                    <td>${new Date(e.date).toLocaleDateString('en-IN')}</td>
                    <td>${e.description}</td>
                    <td><span class="category-badge" style="background: ${this.categoryConfig[e.category]?.color}20; color: ${this.categoryConfig[e.category]?.color}">${this.categoryConfig[e.category]?.icon} ${this.categoryConfig[e.category]?.name}</span></td>
                    <td style="color: var(--accent-red); font-weight: 600;">${this.formatCurrency(e.amount)}</td>
                    <td>
                        <button class="action-btn" onclick="app.openExpenseModal(app.expenses.find(x => x.id === '${e.id}'))">âœï¸</button>
                        <button class="action-btn delete" onclick="app.deleteExpense('${e.id}')">ðŸ—‘ï¸</button>
                    </td>
                </tr>
            `).join('');
        }
    }

    // â”€â”€ Budget â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    renderBudget() {
        const now = new Date();
        const monthExpenses = this.expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const totalSpent = monthExpenses.reduce((s, e) => s + e.amount, 0);
        const remaining  = this.budget.monthly - totalSpent;
        const percent    = this.budget.monthly > 0 ? Math.min(100, (totalSpent / this.budget.monthly) * 100) : 0;

        document.getElementById('totalBudget').textContent          = this.formatCurrency(this.budget.monthly);
        document.getElementById('budgetSpentAmount').textContent    = this.formatCurrency(totalSpent);
        document.getElementById('budgetRemainingAmount').textContent = (remaining < 0 ? '-' : '') + this.formatCurrency(Math.abs(remaining));
        document.getElementById('budgetSpentPercent').textContent   = `${Math.round(percent)}%`;

        const ring         = document.getElementById('budgetRing');
        const circumference = 2 * Math.PI * 52;
        ring.style.strokeDasharray  = circumference;
        ring.style.strokeDashoffset = circumference - (percent / 100) * circumference;
        ring.style.stroke = percent > 90 ? '#ef4444' : percent > 70 ? '#f59e0b' : '#8b5cf6';

        this.renderCategoryBudgets(monthExpenses);
    }

    renderCategoryBudgets(monthExpenses) {
        const catSpending = {};
        monthExpenses.forEach(e => { catSpending[e.category] = (catSpending[e.category] || 0) + e.amount; });
        document.getElementById('categoryBudgetList').innerHTML = Object.keys(this.categoryConfig).map(cat => {
            const spent   = catSpending[cat] || 0;
            const limit   = this.budget.categories[cat] || this.budget.monthly * 0.2;
            const percent = Math.min(100, (spent / limit) * 100);
            const config  = this.categoryConfig[cat];
            return `
                <div class="category-budget-item">
                    <div class="category-budget-header">
                        <span>${config.icon} ${config.name}</span>
                        <span>${this.formatCurrency(spent)} / ${this.formatCurrency(limit)}</span>
                    </div>
                    <div class="category-progress">
                        <div class="category-progress-fill" style="width: ${percent}%; background: ${percent > 90 ? '#ef4444' : config.color}"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // â”€â”€ Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    renderAnalytics() {
        this.renderTopCategories();
        this.renderInsights();
    }

    renderTopCategories() {
        const catSpending = {};
        this.expenses.forEach(e => { catSpending[e.category] = (catSpending[e.category] || 0) + e.amount; });
        const sorted = Object.entries(catSpending).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const total  = sorted.reduce((s, [, v]) => s + v, 0);
        document.getElementById('topCategories').innerHTML = sorted.map(([cat, amount]) => {
            const config  = this.categoryConfig[cat];
            const percent = total > 0 ? (amount / total * 100).toFixed(1) : 0;
            return `
                <div class="category-budget-item">
                    <div class="category-budget-header">
                        <span>${config?.icon || 'ðŸ“¦'} ${config?.name || 'Other'}</span>
                        <span>${this.formatCurrency(amount)} (${percent}%)</span>
                    </div>
                    <div class="category-progress">
                        <div class="category-progress-fill" style="width: ${percent}%; background: ${config?.color || '#64748b'}"></div>
                    </div>
                </div>
            `;
        }).join('') || '<p style="color: var(--text-muted);">No data yet</p>';
    }

    renderInsights() {
        const now       = new Date();
        const thisMonth = this.expenses.filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
        const lastMonth = this.expenses.filter(e => { const d = new Date(e.date); const lm = new Date(now.getFullYear(), now.getMonth() - 1); return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear(); });
        const thisTotal = thisMonth.reduce((s, e) => s + e.amount, 0);
        const lastTotal = lastMonth.reduce((s, e) => s + e.amount, 0);
        const change    = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal * 100).toFixed(0) : 0;
        const highestCat = Object.entries(thisMonth.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; }, {})).sort((a, b) => b[1] - a[1])[0];
        const isOver    = thisTotal > this.budget.monthly;

        document.getElementById('insightsGrid').innerHTML = `
            <div class="stat-card gradient-purple" style="padding:20px">
                <span class="stat-label">Month-over-Month</span>
                <span class="stat-value" style="font-size:24px">${change >= 0 ? '+' : ''}${change}%</span>
                <span class="stat-change">${change >= 0 ? 'Increase' : 'Decrease'} from last month</span>
            </div>
            <div class="stat-card gradient-blue" style="padding:20px">
                <span class="stat-label">Top Category</span>
                <span class="stat-value" style="font-size:24px">${highestCat ? this.categoryConfig[highestCat[0]]?.icon + ' ' + this.categoryConfig[highestCat[0]]?.name : 'N/A'}</span>
                <span class="stat-change">${highestCat ? this.formatCurrency(highestCat[1]) : 'No data'}</span>
            </div>
            <div class="stat-card ${isOver ? 'gradient-orange' : 'gradient-green'}" style="padding:20px">
                <span class="stat-label">Budget Status</span>
                <span class="stat-value" style="font-size:24px">${isOver ? 'âš ï¸ Over' : 'âœ… On Track'}</span>
                <span class="stat-change">${this.formatCurrency(Math.abs(this.budget.monthly - thisTotal))} ${isOver ? 'over budget' : 'remaining'}</span>
            </div>
        `;
    }

    // â”€â”€ Charts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    initCharts() {
        this.initCategoryChart();
        this.initWeeklyChart();
        this.initMonthlyChart();
    }

    initCategoryChart() {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) return;
        const d = this.getCategoryData();
        this.charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: d.labels, datasets: [{ data: d.values, backgroundColor: d.colors, borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#a0aec0', padding: 15 } } }, cutout: '65%' }
        });
    }

    initWeeklyChart() {
        const ctx = document.getElementById('weeklyChart');
        if (!ctx) return;
        const d = this.getWeeklyData();
        this.charts.weekly = new Chart(ctx, {
            type: 'bar',
            data: { labels: d.labels, datasets: [{ label: 'Spending', data: d.values, backgroundColor: 'rgba(139,92,246,0.5)', borderColor: '#8b5cf6', borderWidth: 2, borderRadius: 8 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0aec0' } }, x: { grid: { display: false }, ticks: { color: '#a0aec0' } } } }
        });
    }

    initMonthlyChart() {
        const ctx = document.getElementById('monthlyChart');
        if (!ctx) return;
        const d = this.getMonthlyData();
        this.charts.monthly = new Chart(ctx, {
            type: 'bar',
            data: { labels: d.labels, datasets: [{ label: 'Monthly Spending', data: d.values, backgroundColor: 'rgba(168,85,247,0.6)', borderColor: '#A855F7', borderWidth: 2, borderRadius: 6 }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0aec0' } }, x: { grid: { display: false }, ticks: { color: '#a0aec0' } } } }
        });
    }

    updateCharts() {
        if (this.charts.category) { const d = this.getCategoryData(); this.charts.category.data.labels = d.labels; this.charts.category.data.datasets[0].data = d.values; this.charts.category.update(); }
        if (this.charts.weekly)   { const d = this.getWeeklyData();   this.charts.weekly.data.labels = d.labels;   this.charts.weekly.data.datasets[0].data = d.values;   this.charts.weekly.update(); }
        if (this.charts.monthly)  { const d = this.getMonthlyData();  this.charts.monthly.data.labels = d.labels;  this.charts.monthly.data.datasets[0].data = d.values;  this.charts.monthly.update(); }
    }

    getCategoryData() {
        const now = new Date();
        const me = this.expenses.filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
        const cs = {}; me.forEach(e => { cs[e.category] = (cs[e.category] || 0) + e.amount; });
        const labels = [], values = [], colors = [];
        Object.entries(cs).forEach(([cat, val]) => { labels.push(this.categoryConfig[cat]?.name || 'Other'); values.push(val); colors.push(this.categoryConfig[cat]?.color || '#64748b'); });
        return { labels, values, colors };
    }

    getWeeklyData() {
        const labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], values = [0,0,0,0,0,0,0];
        const now = new Date();
        const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
        this.expenses.forEach(e => { const d = new Date(e.date); if (d >= startOfWeek && d <= new Date()) values[d.getDay()] += e.amount; });
        return { labels, values };
    }

    getMonthlyData() {
        const labels = [], values = [];
        const now = new Date();
        for (let i = 2; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            labels.push(date.toLocaleDateString('en-IN', { month: 'short' }));
            values.push(this.expenses.filter(e => { const d = new Date(e.date); return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear(); }).reduce((s, e) => s + e.amount, 0));
        }
        return { labels, values };
    }

    // â”€â”€ Profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    renderProfile() {
        const name = this.profile.name;
        document.getElementById('profileDisplayName').textContent = name;
        document.getElementById('profileDisplayRoom').textContent = this.profile.room;
        document.getElementById('profileAvatar').textContent = name.charAt(0).toUpperCase();
        document.querySelector('.user-name').textContent = this.username || name;
        document.querySelector('.user-status').textContent = this.profile.room;
        document.querySelector('.avatar').textContent = (this.username || name).charAt(0).toUpperCase();
    }

    toggleProfileForm(show) {
        const form = document.getElementById('profileForm');
        if (show) {
            form.classList.remove('hidden');
            document.getElementById('profileName').value  = this.profile.name;
            document.getElementById('profileRoom').value  = this.profile.room;
            document.getElementById('profileEmail').value = this.profile.email || '';
            document.getElementById('profilePhone').value = this.profile.phone || '';
        } else {
            form.classList.add('hidden');
        }
    }

    saveProfile() {
        this.profile.name  = document.getElementById('profileName').value  || 'Hostler';
        this.profile.room  = document.getElementById('profileRoom').value  || 'Room 404';
        this.profile.email = document.getElementById('profileEmail').value;
        this.profile.phone = document.getElementById('profilePhone').value;
        localStorage.setItem('profile', JSON.stringify(this.profile));
        this.renderProfile();
        this.toggleProfileForm(false);
        this.showToast('Profile updated!', 'success');
    }

    // â”€â”€ Debts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    renderDebts() {
        const totalOwe  = this.debts.filter(d => d.type === 'owe').reduce((s, d) => s + d.amount, 0);
        const totalOwed = this.debts.filter(d => d.type === 'owed').reduce((s, d) => s + d.amount, 0);
        document.getElementById('totalIOwe').textContent     = this.formatCurrency(totalOwe);
        document.getElementById('totalOwedToMe').textContent = this.formatCurrency(totalOwed);

        const container = document.getElementById('debtList');
        if (this.debts.length === 0) {
            container.innerHTML = '<div class="empty-state"><h4>No debts recorded</h4><p>Track money you owe or are owed</p></div>';
            return;
        }
        container.innerHTML = this.debts.map(d => `
            <div class="debt-item">
                <div class="debt-item-left">
                    <div class="debt-item-icon ${d.type}">${d.type === 'owe' ? 'ðŸ“¤' : 'ðŸ“¥'}</div>
                    <div class="debt-item-info">
                        <h4>${d.person}</h4>
                        <p>${d.description || 'No description'} â€¢ ${new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    </div>
                </div>
                <div class="debt-item-right">
                    <span class="debt-item-amount ${d.type}">${d.type === 'owe' ? '-' : '+'}${this.formatCurrency(d.amount)}</span>
                    <div class="debt-actions">
                        <button class="action-btn" onclick="app.markDebtPaid('${d.id}')">âœ…</button>
                        <button class="action-btn delete" onclick="app.deleteDebt('${d.id}')">ðŸ—‘ï¸</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    openDebtModal(debt = null) {
        document.getElementById('debtForm').reset();
        document.getElementById('debtDate').valueAsDate = new Date();
        if (debt) {
            document.getElementById('debtModalTitle').textContent     = 'Edit Debt';
            document.getElementById('debtId').value                   = debt.id;
            document.getElementById('debtPerson').value               = debt.person;
            document.getElementById('debtAmount').value               = debt.amount;
            document.getElementById('debtType').value                 = debt.type;
            document.getElementById('debtDescription').value          = debt.description || '';
            document.getElementById('debtDate').value                 = debt.date;
        } else {
            document.getElementById('debtModalTitle').textContent = 'Add Debt Entry';
            document.getElementById('debtId').value               = '';
        }
        document.getElementById('debtModal').classList.add('active');
    }

    closeDebtModal() { document.getElementById('debtModal').classList.remove('active'); }

    async handleDebtSubmit(e) {
        e.preventDefault();
        const id   = document.getElementById('debtId').value;
        const debt = {
            id:          id || Date.now().toString(),
            person:      document.getElementById('debtPerson').value,
            amount:      parseFloat(document.getElementById('debtAmount').value),
            type:        document.getElementById('debtType').value,
            description: document.getElementById('debtDescription').value,
            date:        document.getElementById('debtDate').value
        };
        if (id) {
            const idx = this.debts.findIndex(d => d.id === id);
            this.debts[idx] = debt;
            await this.apiFetch(`/debts/${id}`, { method: 'PUT', body: debt });
            this.showToast('Debt updated!', 'success');
        } else {
            this.debts.unshift(debt);
            await this.apiFetch('/debts', { method: 'POST', body: debt });
            this.showToast('Debt added!', 'success');
        }
        this.closeDebtModal();
        this.renderDebts();
    }

    async markDebtPaid(id) {
        if (!confirm('Mark as paid/settled?')) return;
        this.debts = this.debts.filter(d => d.id !== id);
        await this.apiFetch(`/debts/${id}`, { method: 'DELETE' });
        this.renderDebts();
        this.showToast('Marked as paid!', 'success');
    }

    async deleteDebt(id) {
        if (!confirm('Delete this debt entry?')) return;
        this.debts = this.debts.filter(d => d.id !== id);
        await this.apiFetch(`/debts/${id}`, { method: 'DELETE' });
        this.renderDebts();
        this.showToast('Debt deleted!', 'success');
    }

    // â”€â”€ Notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    addNotification(icon, message) {
        const key = icon + message;
        const already = this.notifications.find(n => n.key === key);
        if (already) return; // Avoid duplicates
        this.notifications.unshift({ key, icon, message, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) });
        if (this.notifications.length > 20) this.notifications.pop();
        localStorage.setItem('hb_notifs', JSON.stringify(this.notifications));
        this.renderNotifications();
    }

    renderNotifications() {
        const list  = document.getElementById('notifList');
        const badge = document.getElementById('notifBadge');
        if (this.notifications.length === 0) {
            list.innerHTML = '<p class="notif-empty">No new notifications</p>';
            badge.classList.add('hidden');
        } else {
            badge.textContent = this.notifications.length;
            badge.classList.remove('hidden');
            list.innerHTML = this.notifications.map(n => `
                <div class="notif-item">
                    <span class="notif-item-icon">${n.icon}</span>
                    <div><div>${n.message}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px">${n.time}</div></div>
                </div>
            `).join('');
        }
    }

    clearNotifications() {
        this.notifications = [];
        localStorage.setItem('hb_notifs', '[]');
        this.renderNotifications();
        document.getElementById('notifDropdown').classList.add('hidden');
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    pushBrowserNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: 'https://cdn-icons-png.flaticon.com/512/2489/2489756.png' });
        }
    }

    // â”€â”€ Chatbot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    handleChatInput() {
        const input = document.getElementById('chatbotInput');
        const msg   = input.value.trim();
        if (!msg) return;
        input.value = '';
        this.appendChatMsg(msg, 'user');
        setTimeout(() => this.appendChatMsg(this.getBotReply(msg.toLowerCase()), 'bot'), 400);
    }

    appendChatMsg(text, sender) {
        const el = document.createElement('div');
        el.className = `chat-msg ${sender === 'bot' ? 'bot-msg' : 'user-msg'}`;
        el.innerHTML = text;
        const msgs = document.getElementById('chatbotMessages');
        msgs.appendChild(el);
        msgs.scrollTop = msgs.scrollHeight;
    }

    getBotReply(q) {
        const now = new Date();
        const monthExpenses = this.expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const totalSpent = monthExpenses.reduce((s, e) => s + e.amount, 0);
        const budgetLeft = this.budget.monthly - totalSpent;
        const catSpending = {};
        monthExpenses.forEach(e => { catSpending[e.category] = (catSpending[e.category] || 0) + e.amount; });
        const topCat = Object.entries(catSpending).sort((a, b) => b[1] - a[1])[0];

        if (q.includes('budget')) return `Your monthly budget is <b>${this.formatCurrency(this.budget.monthly)}</b>. You have <b>${budgetLeft >= 0 ? this.formatCurrency(budgetLeft) : '-' + this.formatCurrency(Math.abs(budgetLeft))}</b> ${budgetLeft >= 0 ? 'remaining' : 'over budget'}.`;
        if (q.includes('spent') || q.includes('spend') || q.includes('total')) return `You've spent <b>${this.formatCurrency(totalSpent)}</b> this month across <b>${monthExpenses.length}</b> transactions.`;
        if (q.includes('top') || q.includes('category') || q.includes('most')) return topCat ? `Your top category is <b>${this.categoryConfig[topCat[0]]?.icon} ${this.categoryConfig[topCat[0]]?.name}</b> with <b>${this.formatCurrency(topCat[1])}</b> spent.` : "You haven't added any expenses yet!";
        if (q.includes('debt') || q.includes('owe')) { const owe = this.debts.filter(d => d.type === 'owe').reduce((s, d) => s + d.amount, 0); const owed = this.debts.filter(d => d.type === 'owed').reduce((s, d) => s + d.amount, 0); return `You owe <b>${this.formatCurrency(owe)}</b> and are owed <b>${this.formatCurrency(owed)}</b>.`; }
        if (q.includes('average') || q.includes('daily') || q.includes('per day')) { const avg = totalSpent / Math.max(1, now.getDate()); return `Your daily average this month is <b>${this.formatCurrency(avg)}</b>.`; }
        if (q.includes('transaction') || q.includes('count') || q.includes('how many')) return `You have <b>${monthExpenses.length}</b> transactions this month.`;
        if (q.includes('hello') || q.includes('hi') || q.includes('hey')) return `Hey! ðŸ‘‹ I'm BuddyBot. Ask me about your budget, spending, or debts!`;
        if (q.includes('help')) return `I can answer:<br>â€¢ "What's my budget?"<br>â€¢ "How much did I spend?"<br>â€¢ "Top category?"<br>â€¢ "Daily average?"<br>â€¢ "My debts?"`;
        return `Hmm, I'm not sure about that. Try asking about your <b>budget</b>, <b>spending</b>, <b>top category</b>, or <b>debts</b>! ðŸ¤–`;
    }

    // â”€â”€ Utils â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    formatCurrency(amount) {
        return 'â‚¹' + Math.abs(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    exportToExcel() {
        if (this.expenses.length === 0) { this.showToast('No expenses to export!', 'error'); return; }
        const data = this.expenses.map(e => ({
            'Date': new Date(e.date).toLocaleDateString('en-IN'),
            'Description': e.description,
            'Category': this.categoryConfig[e.category]?.name || 'Other',
            'Amount (â‚¹)': e.amount,
            'Note': e.note || ''
        }));
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook  = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');
        worksheet['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 25 }];
        XLSX.writeFile(workbook, `expenses_${new Date().toISOString().split('T')[0]}.xlsx`);
        this.showToast('Exported successfully!', 'success');
    }
}

const app = new ExpenseTracker();
