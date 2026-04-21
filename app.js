// HostelBuddy – Phase 2

class ExpenseTracker {
    constructor() {
        this.expenses   = [];
        this.budget     = { monthly: 10000, categories: {} };
        this.debts      = [];
        this.profile    = JSON.parse(localStorage.getItem('hb_profile')) || { name: 'Hostler', room: 'Room 404', email: '', phone: '' };
        this.token      = localStorage.getItem('hb_token')    || null;
        this.username   = localStorage.getItem('hb_username') || null;
        this.notifKey = `hb_notifs_${this.username || 'guest'}`;
        this.notifications = [];
        this.categoryConfig = {
            food:          { icon: '🍔', color: '#FF6B6B', name: 'Food'          },
            transport:     { icon: '🚌', color: '#4ECDC4', name: 'Transport'     },
            utilities:     { icon: '💡', color: '#FFE66D', name: 'Utilities'     },
            entertainment: { icon: '🎮', color: '#A855F7', name: 'Entertainment' },
            shopping:      { icon: '🛒', color: '#22D3EE', name: 'Shopping'      },
            health:        { icon: '💊', color: '#F472B6', name: 'Health'        },
            other:         { icon: '📦', color: '#94A3B8', name: 'Other'         }
        };
        this.charts  = {};
        this.apiBase = '/api';
        this.init();
    }

    // ── Init ──────────────────────────────────────────────────

    async init() {
        if (!this.token) {
            window.location.href = '/login.html';
            return;
        }
        this.bindEvents();
        this.setCurrentDate();
        await this.loadAll();
        this.requestNotificationPermission();
    }

    // ── Logout ────────────────────────────────────────────────

    async handleLogout() {
        try { await this.apiFetch('/logout', { method: 'POST' }); } catch (_) {}
        localStorage.removeItem('hb_token');
        localStorage.removeItem('hb_username');
        localStorage.removeItem(this.notifKey);
        window.location.href = '/login.html';
    }

    // ── API Helper ────────────────────────────────────────────

    async apiFetch(path, options = {}) {
        const res = await fetch(`${this.apiBase}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                ...(options.headers || {})
            },
            body: options.body
                ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
                : undefined
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

            // If token is stale/invalid, force back to login
            if (expRes.status === 401 || budRes.status === 401 || debRes.status === 401) {
                this.handleLogout();
                return;
            }

            this.expenses = await expRes.json();
            this.budget   = await budRes.json();
            this.debts    = await debRes.json();
        } catch (e) {
            console.warn('API load failed:', e);
            this.showToast('Could not connect to server. Please check if it is running.', 'error');
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

    // ── Events ────────────────────────────────────────────────

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item =>
            item.addEventListener('click', e => this.handleNavigation(e))
        );
        document.querySelectorAll('.view-all').forEach(item =>
            item.addEventListener('click', e => this.handleNavigation(e))
        );
        const profileNav = document.querySelector('.user-profile[data-section="profile"]');
        if (profileNav) profileNav.addEventListener('click', () => this.navigateToSection('profile'));

        // Header
        document.getElementById('menuToggle').addEventListener('click', () =>
            document.getElementById('sidebar').classList.toggle('active')
        );
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

        // Add Expense
        document.getElementById('addExpenseBtn').addEventListener('click', () => this.openExpenseModal());
        document.getElementById('fabAddExpense').addEventListener('click', () => this.openExpenseModal());
        document.getElementById('closeModal').addEventListener('click', () => this.closeExpenseModal());
        document.getElementById('cancelExpense').addEventListener('click', () => this.closeExpenseModal());
        document.getElementById('expenseForm').addEventListener('submit', e => this.handleExpenseSubmit(e));

        // Split toggle
        document.getElementById('splitExpense').addEventListener('change', e =>
            document.getElementById('splitOptions').classList.toggle('active', e.target.checked)
        );

        // Budget modal
        document.getElementById('editBudgetBtn').addEventListener('click', () => this.openBudgetModal());
        document.getElementById('closeBudgetModal').addEventListener('click', () => this.closeBudgetModal());
        document.getElementById('cancelBudget').addEventListener('click', () => this.closeBudgetModal());
        document.getElementById('budgetForm').addEventListener('submit', e => this.handleBudgetSubmit(e));

        // Filters
        document.getElementById('searchExpense').addEventListener('input', () => this.filterExpenses());
        document.getElementById('categoryFilter').addEventListener('change', () => this.filterExpenses());

        // Export
        document.getElementById('exportExcelBtn').addEventListener('click', () => this.exportToExcel());

        // Profile
        document.getElementById('editProfileBtn').addEventListener('click', () => this.toggleProfileForm(true));
        document.getElementById('cancelProfileBtn').addEventListener('click', () => this.toggleProfileForm(false));
        document.getElementById('saveProfileBtn').addEventListener('click', () => this.saveProfile());

        // Debt modal
        document.getElementById('addDebtBtn').addEventListener('click', () => this.openDebtModal());
        document.getElementById('closeDebtModal').addEventListener('click', () => this.closeDebtModal());
        document.getElementById('cancelDebt').addEventListener('click', () => this.closeDebtModal());
        document.getElementById('debtForm').addEventListener('submit', e => this.handleDebtSubmit(e));

        // Notifications — reliable click-outside pattern using .closest()
        document.getElementById('notifBtn').addEventListener('click', () => {
            document.getElementById('notifDropdown').classList.toggle('hidden');
        });
        document.getElementById('clearNotifs').addEventListener('click', () => {
            this.clearNotifications();
        });
        document.addEventListener('click', (e) => {
            // Close unless the click was inside the notification wrapper
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
        document.getElementById('chatbotInput').addEventListener('keydown', e => {
            if (e.key === 'Enter') this.handleChatInput();
        });

        // Close modals on backdrop click
        document.querySelectorAll('.modal-overlay').forEach(overlay =>
            overlay.addEventListener('click', e => {
                if (e.target === overlay) overlay.classList.remove('active');
            })
        );
    }

    setCurrentDate() {
        const el = document.getElementById('currentDate');
        if (el) el.textContent = new Date().toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const dateInput = document.getElementById('expenseDate');
        if (dateInput) dateInput.valueAsDate = new Date();
    }

    handleNavigation(e) {
        e.preventDefault();
        this.navigateToSection(e.currentTarget.dataset.section);
    }

    navigateToSection(section) {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        const nav = document.querySelector(`.nav-item[data-section="${section}"]`);
        if (nav) nav.classList.add('active');
        document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
        const sec = document.getElementById(section);
        if (sec) sec.classList.remove('hidden');
        const titleEl = document.getElementById('pageTitle');
        if (titleEl) titleEl.textContent = section.charAt(0).toUpperCase() + section.slice(1);
        document.getElementById('sidebar').classList.remove('active');
    }

    // ── Expense Modal ─────────────────────────────────────────

    openExpenseModal(expense = null) {
        document.getElementById('expenseForm').reset();
        document.getElementById('splitExpense').checked = false;
        document.getElementById('splitOptions').classList.remove('active');
        if (expense) {
            document.getElementById('modalTitle').textContent   = 'Edit Expense';
            document.getElementById('expenseId').value         = expense.id;
            document.getElementById('expenseAmount').value     = expense.amount;
            document.getElementById('expenseDescription').value = expense.description;
            document.getElementById('expenseCategory').value   = expense.category;
            document.getElementById('expenseDate').value       = expense.date;
            document.getElementById('expenseNote').value       = expense.note || '';
        } else {
            document.getElementById('modalTitle').textContent = 'Add Expense';
            document.getElementById('expenseId').value       = '';
            document.getElementById('expenseDate').valueAsDate = new Date();
        }
        document.getElementById('expenseModal').classList.add('active');
    }

    closeExpenseModal() {
        document.getElementById('expenseModal').classList.remove('active');
    }

    async handleExpenseSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('expenseId').value;
        const expense = {
            id:          id || Date.now().toString(),
            amount:      parseFloat(document.getElementById('expenseAmount').value),
            description: document.getElementById('expenseDescription').value,
            category:    document.getElementById('expenseCategory').value,
            date:        document.getElementById('expenseDate').value,
            note:        document.getElementById('expenseNote').value
        };

        if (id) {
            const idx = this.expenses.findIndex(e => e.id === id);
            if (idx !== -1) this.expenses[idx] = expense;
            await this.apiFetch(`/expenses/${id}`, { method: 'PUT', body: expense });
            this.showToast('Expense updated!', 'success');
        } else {
            this.expenses.unshift(expense);
            await this.apiFetch('/expenses', { method: 'POST', body: expense });
            this.showToast('Expense added!', 'success');

            if (document.getElementById('splitExpense').checked) {
                const count  = parseInt(document.getElementById('splitCount').value) || 2;
                const person = document.getElementById('splitPerson').value || 'Roommate';
                if (count >= 2) {
                    const share = expense.amount / count;
                    const debt  = {
                        id: Date.now().toString() + '-split', person,
                        amount: share, type: 'owed',
                        description: `Split for ${expense.description}`,
                        date: expense.date
                    };
                    this.debts.unshift(debt);
                    await this.apiFetch('/debts', { method: 'POST', body: debt });
                    this.renderDebts();
                    this.showToast(`₹${share.toFixed(0)} split with ${person}`, 'info');
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
        const ok = await this.showConfirm('Delete this expense? This cannot be undone.', 'Delete Expense');
        if (!ok) return;
        this.expenses = this.expenses.filter(e => e.id !== id);
        await this.apiFetch(`/expenses/${id}`, { method: 'DELETE' });
        this.updateDashboard();
        this.renderExpenses();
        this.renderBudget();
        this.renderAnalytics();
        this.updateCharts();
        this.showToast('Expense deleted!', 'success');
    }

    // ── Budget Modal ──────────────────────────────────────────

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

    // ── Dashboard ─────────────────────────────────────────────

    updateDashboard() {
        const now = new Date();
        const monthExpenses = this.expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        const totalSpent   = monthExpenses.reduce((s, e) => s + e.amount, 0);
        const budgetLeft   = this.budget.monthly - totalSpent;  // negative when over budget
        const isOver       = budgetLeft < 0;
        const budgetPercent = this.budget.monthly > 0
            ? Math.round(Math.abs(budgetLeft) / this.budget.monthly * 100) : 0;
        const dailyAvg     = totalSpent / Math.max(1, now.getDate());

        const fmt = v => this.formatCurrency(v);

        document.getElementById('totalSpent').textContent       = fmt(totalSpent);
        document.getElementById('budgetLeft').textContent       = (isOver ? '-' : '') + fmt(Math.abs(budgetLeft));
        document.getElementById('transactionCount').textContent = monthExpenses.length;
        document.getElementById('dailyAverage').textContent     = fmt(dailyAvg);

        const card  = document.getElementById('budgetLeftCard');
        const pctEl = document.getElementById('budgetPercent');
        if (isOver) {
            card.classList.add('over-budget');
            pctEl.textContent = `${budgetPercent}% over budget`;
        } else {
            card.classList.remove('over-budget');
            pctEl.textContent = `${100 - Math.min(100, budgetPercent)}% remaining`;
        }

        // Notifications for budget (only trigger once per session, not every re-render)
        const spentPct = this.budget.monthly > 0 ? (totalSpent / this.budget.monthly) * 100 : 0;
        if (!this._budgetAlerted) {
            if (spentPct >= 100) {
                this.addNotification('🚨', `Over budget by ${fmt(Math.abs(budgetLeft))}!`);
                this.pushBrowserNotification('Budget Alert!', `Over budget by ${fmt(Math.abs(budgetLeft))}`);
                this._budgetAlerted = true;
            } else if (spentPct >= 80) {
                this.addNotification('⚠️', `${Math.round(spentPct)}% of budget used!`);
                this._budgetAlerted = true;
            }
        }

        this.renderRecentTransactions(monthExpenses.slice(0, 5));
    }

    renderRecentTransactions(transactions) {
        const el = document.getElementById('recentTransactions');
        if (!el) return;
        if (transactions.length === 0) {
            el.innerHTML = '<div class="empty-state"><h4>No transactions yet</h4><p>Add your first expense!</p></div>';
            return;
        }
        el.innerHTML = transactions.map(t => {
            const cat = this.categoryConfig[t.category] || this.categoryConfig.other;
            return `
            <div class="transaction-item">
                <div class="transaction-left">
                    <div class="transaction-icon ${t.category}">${cat.icon}</div>
                    <div class="transaction-info">
                        <h4>${this.sanitize(t.description)}</h4>
                        <p>${new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${cat.name}</p>
                    </div>
                </div>
                <span class="transaction-amount">-${this.formatCurrency(t.amount)}</span>
            </div>`;
        }).join('');
    }

    // ── Expenses Table ────────────────────────────────────────

    renderExpenses() { this.filterExpenses(); }

    filterExpenses() {
        const search   = document.getElementById('searchExpense').value.toLowerCase();
        const category = document.getElementById('categoryFilter').value;

        let filtered = this.expenses;
        if (search)        filtered = filtered.filter(e => e.description.toLowerCase().includes(search));
        if (category !== 'all') filtered = filtered.filter(e => e.category === category);

        const tbody = document.getElementById('expensesTableBody');
        const empty = document.getElementById('emptyExpenses');

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            tbody.innerHTML = filtered.map(e => {
                const cat = this.categoryConfig[e.category] || this.categoryConfig.other;
                return `<tr>
                    <td>${new Date(e.date).toLocaleDateString('en-IN')}</td>
                    <td>${this.sanitize(e.description)}</td>
                    <td><span class="category-badge" style="background:${cat.color}20;color:${cat.color}">${cat.icon} ${cat.name}</span></td>
                    <td style="color:var(--accent-red);font-weight:600;">${this.formatCurrency(e.amount)}</td>
                    <td>
                        <button class="action-btn" onclick="app.openExpenseModal(app.expenses.find(x=>x.id==='${e.id}'))">✏️</button>
                        <button class="action-btn delete" onclick="app.deleteExpense('${e.id}')">🗑️</button>
                    </td>
                </tr>`;
            }).join('');
        }
    }

    // ── Budget ────────────────────────────────────────────────

    renderBudget() {
        const now = new Date();
        const monthExpenses = this.expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const totalSpent = monthExpenses.reduce((s, e) => s + e.amount, 0);
        const remaining  = this.budget.monthly - totalSpent;
        const percent    = this.budget.monthly > 0 ? Math.min(100, (totalSpent / this.budget.monthly) * 100) : 0;

        document.getElementById('totalBudget').textContent           = this.formatCurrency(this.budget.monthly);
        document.getElementById('budgetSpentAmount').textContent     = this.formatCurrency(totalSpent);
        document.getElementById('budgetRemainingAmount').textContent = (remaining < 0 ? '-' : '') + this.formatCurrency(Math.abs(remaining));
        document.getElementById('budgetSpentPercent').textContent    = `${Math.round(percent)}%`;

        const ring = document.getElementById('budgetRing');
        if (ring) {
            const circumference = 2 * Math.PI * 52;
            ring.style.strokeDasharray  = circumference;
            ring.style.strokeDashoffset = circumference - (percent / 100) * circumference;
            ring.style.stroke = percent > 90 ? '#ef4444' : percent > 70 ? '#f59e0b' : '#8b5cf6';
        }

        this.renderCategoryBudgets(monthExpenses);
    }

    renderCategoryBudgets(monthExpenses) {
        const catSpending = {};
        monthExpenses.forEach(e => { catSpending[e.category] = (catSpending[e.category] || 0) + e.amount; });
        const el = document.getElementById('categoryBudgetList');
        if (!el) return;
        el.innerHTML = Object.keys(this.categoryConfig).map(cat => {
            const spent   = catSpending[cat] || 0;
            const limit   = this.budget.categories[cat] || this.budget.monthly * 0.2;
            const percent = Math.min(100, (spent / limit) * 100);
            const cfg     = this.categoryConfig[cat];
            return `<div class="category-budget-item">
                <div class="category-budget-header"><span>${cfg.icon} ${cfg.name}</span><span>${this.formatCurrency(spent)} / ${this.formatCurrency(limit)}</span></div>
                <div class="category-progress"><div class="category-progress-fill" style="width:${percent}%;background:${percent > 90 ? '#ef4444' : cfg.color}"></div></div>
            </div>`;
        }).join('');
    }

    // ── Analytics ─────────────────────────────────────────────

    renderAnalytics() {
        this.renderTopCategories();
        this.renderInsights();
    }

    renderTopCategories() {
        const catSpending = {};
        this.expenses.forEach(e => { catSpending[e.category] = (catSpending[e.category] || 0) + e.amount; });
        const sorted = Object.entries(catSpending).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const total  = sorted.reduce((s, [, v]) => s + v, 0);
        const el     = document.getElementById('topCategories');
        if (!el) return;
        el.innerHTML = sorted.map(([cat, amount]) => {
            const cfg     = this.categoryConfig[cat] || this.categoryConfig.other;
            const percent = total > 0 ? (amount / total * 100).toFixed(1) : 0;
            return `<div class="category-budget-item">
                <div class="category-budget-header"><span>${cfg.icon} ${cfg.name}</span><span>${this.formatCurrency(amount)} (${percent}%)</span></div>
                <div class="category-progress"><div class="category-progress-fill" style="width:${percent}%;background:${cfg.color}"></div></div>
            </div>`;
        }).join('') || '<p style="color:var(--text-muted);padding:16px">No data yet</p>';
    }

    renderInsights() {
        const now       = new Date();
        const thisMonth = this.expenses.filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
        const lastMonth = this.expenses.filter(e => { const d = new Date(e.date); const lm = new Date(now.getFullYear(), now.getMonth() - 1); return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear(); });
        const thisTotal = thisMonth.reduce((s, e) => s + e.amount, 0);
        const lastTotal = lastMonth.reduce((s, e) => s + e.amount, 0);
        const change    = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal * 100).toFixed(0) : 0;
        const catMap    = thisMonth.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; }, {});
        const topCat    = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
        const isOver    = thisTotal > this.budget.monthly;
        const el        = document.getElementById('insightsGrid');
        if (!el) return;
        el.innerHTML = `
            <div class="stat-card gradient-purple" style="padding:20px">
                <span class="stat-label">Month-over-Month</span>
                <span class="stat-value" style="font-size:24px">${change >= 0 ? '+' : ''}${change}%</span>
                <span class="stat-change">${change >= 0 ? 'Increase' : 'Decrease'} from last month</span>
            </div>
            <div class="stat-card gradient-blue" style="padding:20px">
                <span class="stat-label">Top Category</span>
                <span class="stat-value" style="font-size:24px">${topCat ? this.categoryConfig[topCat[0]]?.icon + ' ' + this.categoryConfig[topCat[0]]?.name : 'N/A'}</span>
                <span class="stat-change">${topCat ? this.formatCurrency(topCat[1]) : 'No data'}</span>
            </div>
            <div class="stat-card ${isOver ? 'gradient-orange' : 'gradient-green'}" style="padding:20px">
                <span class="stat-label">Budget Status</span>
                <span class="stat-value" style="font-size:24px">${isOver ? '⚠️ Over' : '✅ On Track'}</span>
                <span class="stat-change">${this.formatCurrency(Math.abs(this.budget.monthly - thisTotal))} ${isOver ? 'over budget' : 'remaining'}</span>
            </div>`;
    }

    // ── Charts ────────────────────────────────────────────────

    initCharts() {
        this.initCategoryChart();
        this.initWeeklyChart();
        this.initMonthlyChart();
    }

    initCategoryChart() {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) return;
        if (this.charts.category) { this.charts.category.destroy(); }
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
        if (this.charts.weekly) { this.charts.weekly.destroy(); }
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
        if (this.charts.monthly) { this.charts.monthly.destroy(); }
        const d = this.getMonthlyData();
        this.charts.monthly = new Chart(ctx, {
            type: 'bar',
            data: { labels: d.labels, datasets: [{ label: 'Monthly Spending', data: d.values, backgroundColor: 'rgba(168,85,247,0.6)', borderColor: '#A855F7', borderWidth: 2, borderRadius: 6 }] },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0aec0' } }, x: { grid: { display: false }, ticks: { color: '#a0aec0' } } } }
        });
    }

    updateCharts() {
        const cd = this.getCategoryData();
        if (this.charts.category) { this.charts.category.data.labels = cd.labels; this.charts.category.data.datasets[0].data = cd.values; this.charts.category.update(); }
        const wd = this.getWeeklyData();
        if (this.charts.weekly)   { this.charts.weekly.data.datasets[0].data = wd.values; this.charts.weekly.update(); }
        const md = this.getMonthlyData();
        if (this.charts.monthly)  { this.charts.monthly.data.datasets[0].data = md.values; this.charts.monthly.update(); }
    }

    getCategoryData() {
        const now = new Date();
        const me  = this.expenses.filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
        const cs  = {};
        me.forEach(e => { cs[e.category] = (cs[e.category] || 0) + e.amount; });
        const labels = [], values = [], colors = [];
        Object.entries(cs).forEach(([cat, val]) => {
            const cfg = this.categoryConfig[cat] || this.categoryConfig.other;
            labels.push(cfg.name); values.push(val); colors.push(cfg.color);
        });
        return { labels, values, colors };
    }

    getWeeklyData() {
        const labels  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const values  = [0,0,0,0,0,0,0];
        const now     = new Date();
        const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
        this.expenses.forEach(e => { const d = new Date(e.date); if (d >= startOfWeek) values[d.getDay()] += e.amount; });
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

    // ── Profile ───────────────────────────────────────────────

    renderProfile() {
        const name = this.profile.name || 'Hostler';
        const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        setEl('profileDisplayName', name);
        setEl('profileDisplayRoom', this.profile.room);
        setEl('profileAvatar', name.charAt(0).toUpperCase());
        const uname = document.querySelector('.user-name');
        const ustatus = document.querySelector('.user-status');
        const avatar = document.querySelector('.avatar');
        if (uname)   uname.textContent   = this.username || name;
        if (ustatus) ustatus.textContent = this.profile.room;
        if (avatar)  avatar.textContent  = (this.username || name).charAt(0).toUpperCase();
    }

    toggleProfileForm(show) {
        const form = document.getElementById('profileForm');
        if (!form) return;
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
        localStorage.setItem('hb_profile', JSON.stringify(this.profile));
        this.renderProfile();
        this.toggleProfileForm(false);
        this.showToast('Profile updated!', 'success');
    }

    // ── Debts ─────────────────────────────────────────────────

    renderDebts() {
        const totalOwe  = this.debts.filter(d => d.type === 'owe').reduce((s, d) => s + d.amount, 0);
        const totalOwed = this.debts.filter(d => d.type === 'owed').reduce((s, d) => s + d.amount, 0);
        const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        setEl('totalIOwe',     this.formatCurrency(totalOwe));
        setEl('totalOwedToMe', this.formatCurrency(totalOwed));

        const container = document.getElementById('debtList');
        if (!container) return;
        if (this.debts.length === 0) {
            container.innerHTML = '<div class="empty-state"><h4>No debts recorded</h4><p>Track money you owe or are owed</p></div>';
            return;
        }
        container.innerHTML = this.debts.map(d => `
            <div class="debt-item">
                <div class="debt-item-left">
                    <div class="debt-item-icon ${d.type}">${d.type === 'owe' ? '📤' : '📥'}</div>
                    <div class="debt-item-info">
                        <h4>${this.sanitize(d.person)}</h4>
                        <p>${this.sanitize(d.description || 'No description')} · ${new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    </div>
                </div>
                <div class="debt-item-right">
                    <span class="debt-item-amount ${d.type}">${d.type === 'owe' ? '-' : '+'}${this.formatCurrency(d.amount)}</span>
                    <div class="debt-actions">
                        <button class="action-btn" onclick="app.markDebtPaid('${d.id}')">✅</button>
                        <button class="action-btn delete" onclick="app.deleteDebt('${d.id}')">🗑️</button>
                    </div>
                </div>
            </div>`).join('');
    }

    openDebtModal(debt = null) {
        document.getElementById('debtForm').reset();
        document.getElementById('debtDate').valueAsDate = new Date();
        if (debt) {
            document.getElementById('debtModalTitle').textContent = 'Edit Debt';
            document.getElementById('debtId').value          = debt.id;
            document.getElementById('debtPerson').value      = debt.person;
            document.getElementById('debtAmount').value      = debt.amount;
            document.getElementById('debtType').value        = debt.type;
            document.getElementById('debtDescription').value = debt.description || '';
            document.getElementById('debtDate').value        = debt.date;
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
            if (idx !== -1) this.debts[idx] = debt;
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
        const ok = await this.showConfirm('Mark this debt as settled? It will be removed from your list.', 'Mark as Paid');
        if (!ok) return;
        this.debts = this.debts.filter(d => d.id !== id);
        await this.apiFetch(`/debts/${id}`, { method: 'DELETE' });
        this.renderDebts();
        this.showToast('Marked as paid!', 'success');
    }

    async deleteDebt(id) {
        const ok = await this.showConfirm('Delete this debt entry? This cannot be undone.', 'Delete Debt');
        if (!ok) return;
        this.debts = this.debts.filter(d => d.id !== id);
        await this.apiFetch(`/debts/${id}`, { method: 'DELETE' });
        this.renderDebts();
        this.showToast('Debt deleted!', 'success');
    }

    // ── Notifications ─────────────────────────────────────────

    addNotification(icon, message) {
        const key = icon + message;
        if (this.notifications.find(n => n.key === key)) return;
        this.notifications.unshift({ key, icon, message, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) });
        if (this.notifications.length > 20) this.notifications.pop();
        this.renderNotifications();
    }

    renderNotifications() {
        const list  = document.getElementById('notifList');
        const badge = document.getElementById('notifBadge');
        if (!list || !badge) return;
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
                </div>`).join('');
        }
    }

    clearNotifications() {
        this.notifications = [];
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

    // ── Chatbot ───────────────────────────────────────────────

    handleChatInput() {
        const input = document.getElementById('chatbotInput');
        const msg   = input.value.trim();
        if (!msg) return;
        input.value = '';
        this.appendChatMsg(msg, 'user');
        this.appendChatMsg('<span class="typing">BuddyBot is thinking...</span>', 'bot', 'thinking-msg');
        this.callGemini(msg);
    }

    buildContext() {
        const now = new Date();
        const monthExpenses = this.expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const totalSpent = monthExpenses.reduce((s, e) => s + e.amount, 0);
        const categoryBreakdown = {};
        monthExpenses.forEach(e => {
            const name = this.categoryConfig[e.category]?.name || e.category;
            categoryBreakdown[name] = (categoryBreakdown[name] || 0) + e.amount;
        });
        return {
            budget:        this.budget,
            totalSpent,
            budgetLeft:    this.budget.monthly - totalSpent,
            transactionCount: monthExpenses.length,
            dailyAvg:      Math.round(totalSpent / Math.max(1, now.getDate())),
            categoryBreakdown,
            recentExpenses: monthExpenses.slice(0, 5).map(e => ({
                date:        e.date,
                description: e.description,
                category:    this.categoryConfig[e.category]?.name || e.category,
                amount:      e.amount
            })),
            totalOwe:  this.debts.filter(d => d.type === 'owe').reduce((s, d) => s + d.amount, 0),
            totalOwed: this.debts.filter(d => d.type === 'owed').reduce((s, d) => s + d.amount, 0)
        };
    }

    async callGemini(message) {
        try {
            const res = await this.apiFetch('/chat', {
                method: 'POST',
                body: { message, context: this.buildContext() }
            });
            const data = await res.json();
            const thinking = document.querySelector('.thinking-msg');
            if (thinking) thinking.remove();
            if (!res.ok || data.error) {
                // If API key not set, fall back to rule-based
                this.appendChatMsg(data.error?.includes('not configured')
                    ? `⚙️ AI not configured yet. ${this.getBotReplyLocal(message.toLowerCase())}`
                    : `❌ ${data.error || 'Something went wrong.'}`, 'bot');
                return;
            }
            this.appendChatMsg(data.reply, 'bot');
        } catch (e) {
            const thinking = document.querySelector('.thinking-msg');
            if (thinking) thinking.remove();
            this.appendChatMsg(this.getBotReplyLocal(message.toLowerCase()), 'bot');
        }
    }

    appendChatMsg(text, sender, extraClass = '') {
        const el = document.createElement('div');
        el.className = `chat-msg ${sender === 'bot' ? 'bot-msg' : 'user-msg'} ${extraClass}`.trim();
        // Bot messages use trusted HTML (formatting tags); user messages are sanitized
        if (sender === 'bot') {
            el.innerHTML = text;
        } else {
            el.textContent = text;
        }
        const msgs = document.getElementById('chatbotMessages');
        msgs.appendChild(el);
        msgs.scrollTop = msgs.scrollHeight;
    }

    // Rule-based fallback (used when Gemini API key is not set)
    getBotReplyLocal(q) {
        const now           = new Date();
        const monthExpenses = this.expenses.filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
        const totalSpent    = monthExpenses.reduce((s, e) => s + e.amount, 0);
        const budgetLeft    = this.budget.monthly - totalSpent;
        const catSpending   = {};
        monthExpenses.forEach(e => { catSpending[e.category] = (catSpending[e.category] || 0) + e.amount; });
        const topCat = Object.entries(catSpending).sort((a, b) => b[1] - a[1])[0];

        if (q.includes('budget'))                         return `Your budget is <b>${this.formatCurrency(this.budget.monthly)}</b>. You have <b>${budgetLeft >= 0 ? this.formatCurrency(budgetLeft) : '-' + this.formatCurrency(Math.abs(budgetLeft))}</b> ${budgetLeft >= 0 ? 'left' : 'over budget'}.`;
        if (q.includes('spent') || q.includes('spend') || q.includes('total')) return `You've spent <b>${this.formatCurrency(totalSpent)}</b> this month in <b>${monthExpenses.length}</b> transactions.`;
        if (q.includes('top')   || q.includes('category') || q.includes('most')) return topCat ? `Top category: <b>${this.categoryConfig[topCat[0]]?.icon} ${this.categoryConfig[topCat[0]]?.name}</b> — <b>${this.formatCurrency(topCat[1])}</b>` : "No expenses yet!";
        if (q.includes('debt')  || q.includes('owe'))    { const owe = this.debts.filter(d => d.type === 'owe').reduce((s, d) => s + d.amount, 0); const owed = this.debts.filter(d => d.type === 'owed').reduce((s, d) => s + d.amount, 0); return `You owe <b>${this.formatCurrency(owe)}</b> and are owed <b>${this.formatCurrency(owed)}</b>.`; }
        if (q.includes('average') || q.includes('daily')) { const avg = totalSpent / Math.max(1, now.getDate()); return `Daily average: <b>${this.formatCurrency(avg)}</b>`; }
        if (q.includes('hi') || q.includes('hello') || q.includes('hey')) return `Hey! 👋 Ask me about your budget, spending, debts, or top category!`;
        if (q.includes('help')) return `I can answer:<br>• "What's my budget?"<br>• "How much did I spend?"<br>• "Top category?"<br>• "My debts?"<br>• "Daily average?"`;
        return `Hmm, try asking about your <b>budget</b>, <b>spending</b>, <b>debts</b>, or <b>top category</b>! 🤖`;
    }

    // ── Utils ─────────────────────────────────────────────────

    // Bug 4 fix: escape user-generated content before injecting into innerHTML
    sanitize(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Bug 3 fix: custom confirm modal instead of window.confirm()
    showConfirm(message, title = 'Are you sure?') {
        return new Promise((resolve) => {
            const modal   = document.getElementById('confirmModal');
            const titleEl = document.getElementById('confirmTitle');
            const msgEl   = document.getElementById('confirmMessage');
            const okBtn   = document.getElementById('confirmOkBtn');
            const cancelBtn = document.getElementById('confirmCancelBtn');

            titleEl.textContent = title;
            msgEl.textContent   = message;
            modal.classList.add('active');

            const cleanup = () => {
                modal.classList.remove('active');
                okBtn.removeEventListener('click', onOk);
                cancelBtn.removeEventListener('click', onCancel);
            };
            const onOk     = () => { cleanup(); resolve(true);  };
            const onCancel = () => { cleanup(); resolve(false); };

            okBtn.addEventListener('click', onOk);
            cancelBtn.addEventListener('click', onCancel);
        });
    }

    formatCurrency(amount) {
        return '₹' + Math.abs(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }

    exportToExcel() {
        if (!window.XLSX) { this.showToast('Excel library not loaded!', 'error'); return; }
        if (this.expenses.length === 0) { this.showToast('No expenses to export!', 'error'); return; }
        const data = this.expenses.map(e => ({
            'Date':        new Date(e.date).toLocaleDateString('en-IN'),
            'Description': e.description,
            'Category':    (this.categoryConfig[e.category] || this.categoryConfig.other).name,
            'Amount (₹)':  e.amount,
            'Note':        e.note || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
        ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 25 }];
        XLSX.writeFile(wb, `hostelbuddy_expenses_${new Date().toISOString().split('T')[0]}.xlsx`);
        this.showToast('Exported successfully!', 'success');
    }
}

const app = new ExpenseTracker();