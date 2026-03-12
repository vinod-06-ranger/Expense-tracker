// HostelBuddy - Expense Tracker for Hostlers
class ExpenseTracker {
    constructor() {
        this.expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        this.budget = JSON.parse(localStorage.getItem('budget')) || { monthly: 10000, categories: {} };
        this.profile = JSON.parse(localStorage.getItem('profile')) || { name: 'Hostler', room: 'Room 404', email: '', phone: '' };
        this.debts = JSON.parse(localStorage.getItem('debts')) || [];
        this.categoryConfig = {
            food: { icon: '🍔', color: '#FF6B6B', name: 'Food' },
            transport: { icon: '🚌', color: '#4ECDC4', name: 'Transport' },
            utilities: { icon: '💡', color: '#FFE66D', name: 'Utilities' },
            entertainment: { icon: '🎮', color: '#A855F7', name: 'Entertainment' },
            shopping: { icon: '🛒', color: '#22D3EE', name: 'Shopping' },
            health: { icon: '💊', color: '#F472B6', name: 'Health' },
            other: { icon: '📦', color: '#94A3B8', name: 'Other' }
        };
        this.charts = {};
        this.apiBase = '/api';
        this.useApi = true;
        this.init();
    }

    async init() {
        this.bindEvents();
        this.setCurrentDate();
        await this.loadFromApi();
        this.updateDashboard();
        this.renderExpenses();
        this.renderBudget();
        this.renderAnalytics();
        this.initCharts();
    }

    async loadFromApi() {
        try {
            const [expensesRes, budgetRes] = await Promise.all([
                fetch(`${this.apiBase}/expenses`),
                fetch(`${this.apiBase}/budget`)
            ]);
            if (expensesRes.ok && budgetRes.ok) {
                this.expenses = await expensesRes.json();
                this.budget = await budgetRes.json();
                localStorage.setItem('expenses', JSON.stringify(this.expenses));
                localStorage.setItem('budget', JSON.stringify(this.budget));
            } else {
                this.useApi = false;
            }
        } catch (error) {
            console.log('API unavailable, using localStorage');
            this.useApi = false;
        }
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => this.handleNavigation(e));
        });
        document.querySelectorAll('.view-all').forEach(item => {
            item.addEventListener('click', (e) => this.handleNavigation(e));
        });

        // User profile click to navigate to profile
        document.querySelector('.user-profile[data-section="profile"]').addEventListener('click', (e) => {
            this.navigateToSection('profile');
        });

        // Mobile menu
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('active');
        });

        // Expense modal
        document.getElementById('addExpenseBtn').addEventListener('click', () => this.openExpenseModal());
        document.getElementById('closeModal').addEventListener('click', () => this.closeExpenseModal());
        document.getElementById('cancelExpense').addEventListener('click', () => this.closeExpenseModal());
        document.getElementById('expenseForm').addEventListener('submit', (e) => this.handleExpenseSubmit(e));

        // Budget modal
        document.getElementById('editBudgetBtn').addEventListener('click', () => this.openBudgetModal());
        document.getElementById('closeBudgetModal').addEventListener('click', () => this.closeBudgetModal());
        document.getElementById('cancelBudget').addEventListener('click', () => this.closeBudgetModal());
        document.getElementById('budgetForm').addEventListener('submit', (e) => this.handleBudgetSubmit(e));

        // Filters
        document.getElementById('searchExpense').addEventListener('input', () => this.filterExpenses());
        document.getElementById('categoryFilter').addEventListener('change', () => this.filterExpenses());

        // Excel Export
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

        // Close modal on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.remove('active');
            });
        });

        // Initialize profile display
        this.renderProfile();
        this.renderDebts();
    }

    setCurrentDate() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-IN', options);
        document.getElementById('expenseDate').valueAsDate = new Date();
    }

    handleNavigation(e) {
        e.preventDefault();
        const section = e.currentTarget.dataset.section;
        this.navigateToSection(section);
    }

    navigateToSection(section) {
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
        if (navItem) navItem.classList.add('active');

        document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
        document.getElementById(section).classList.remove('hidden');

        document.getElementById('pageTitle').textContent = section.charAt(0).toUpperCase() + section.slice(1);
        document.getElementById('sidebar').classList.remove('active');
    }

    // Expense Modal
    openExpenseModal(expense = null) {
        const modal = document.getElementById('expenseModal');
        const form = document.getElementById('expenseForm');
        form.reset();

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

    handleExpenseSubmit(e) {
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
            const index = this.expenses.findIndex(e => e.id === id);
            this.expenses[index] = expense;
            this.saveExpenseToApi(expense, true);
            this.showToast('Expense updated successfully!', 'success');
        } else {
            this.expenses.unshift(expense);
            this.saveExpenseToApi(expense, false);
            this.showToast('Expense added successfully!', 'success');
        }

        this.saveExpenses();
        this.closeExpenseModal();
        this.updateDashboard();
        this.renderExpenses();
        this.renderBudget();
        this.renderAnalytics();
        this.updateCharts();
    }

    deleteExpense(id) {
        if (confirm('Are you sure you want to delete this expense?')) {
            this.expenses = this.expenses.filter(e => e.id !== id);
            this.saveExpenses();
            this.deleteExpenseFromApi(id);
            this.updateDashboard();
            this.renderExpenses();
            this.renderBudget();
            this.renderAnalytics();
            this.updateCharts();
            this.showToast('Expense deleted!', 'success');
        }
    }

    saveExpenses() {
        localStorage.setItem('expenses', JSON.stringify(this.expenses));
    }

    async saveExpenseToApi(expense, isUpdate = false) {
        if (!this.useApi) return;
        try {
            const url = isUpdate ? `${this.apiBase}/expenses/${expense.id}` : `${this.apiBase}/expenses`;
            const method = isUpdate ? 'PUT' : 'POST';
            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(expense)
            });
        } catch (error) {
            console.error('Failed to save to API:', error);
        }
    }

    async deleteExpenseFromApi(id) {
        if (!this.useApi) return;
        try {
            await fetch(`${this.apiBase}/expenses/${id}`, { method: 'DELETE' });
        } catch (error) {
            console.error('Failed to delete from API:', error);
        }
    }

    // Budget Modal
    openBudgetModal() {
        const modal = document.getElementById('budgetModal');
        document.getElementById('monthlyBudget').value = this.budget.monthly;
        Object.keys(this.categoryConfig).forEach(cat => {
            const input = document.getElementById(`budget${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
            if (input) input.value = this.budget.categories[cat] || '';
        });
        modal.classList.add('active');
    }

    closeBudgetModal() {
        document.getElementById('budgetModal').classList.remove('active');
    }

    handleBudgetSubmit(e) {
        e.preventDefault();
        this.budget.monthly = parseFloat(document.getElementById('monthlyBudget').value);
        Object.keys(this.categoryConfig).forEach(cat => {
            const input = document.getElementById(`budget${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
            if (input && input.value) this.budget.categories[cat] = parseFloat(input.value);
        });
        localStorage.setItem('budget', JSON.stringify(this.budget));
        this.saveBudgetToApi();
        this.closeBudgetModal();
        this.updateDashboard();
        this.renderBudget();
        this.showToast('Budget updated!', 'success');
    }

    async saveBudgetToApi() {
        if (!this.useApi) return;
        try {
            await fetch(`${this.apiBase}/budget`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.budget)
            });
        } catch (error) {
            console.error('Failed to save budget to API:', error);
        }
    }

    // Dashboard
    updateDashboard() {
        const now = new Date();
        const monthExpenses = this.expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        const totalSpent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
        const budgetLeft = Math.max(0, this.budget.monthly - totalSpent);
        const budgetPercent = this.budget.monthly > 0 ? Math.round((budgetLeft / this.budget.monthly) * 100) : 0;
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const dailyAvg = totalSpent / Math.max(1, now.getDate());

        document.getElementById('totalSpent').textContent = this.formatCurrency(totalSpent);
        document.getElementById('budgetLeft').textContent = this.formatCurrency(budgetLeft);
        document.getElementById('budgetPercent').textContent = `${budgetPercent}% remaining`;
        document.getElementById('transactionCount').textContent = monthExpenses.length;
        document.getElementById('dailyAverage').textContent = this.formatCurrency(dailyAvg);

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
                    <div class="transaction-icon ${t.category}">${this.categoryConfig[t.category]?.icon || '📦'}</div>
                    <div class="transaction-info">
                        <h4>${t.description}</h4>
                        <p>${new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • ${this.categoryConfig[t.category]?.name || 'Other'}</p>
                    </div>
                </div>
                <span class="transaction-amount">-${this.formatCurrency(t.amount)}</span>
            </div>
        `).join('');
    }

    // Expenses Table
    renderExpenses() {
        this.filterExpenses();
    }

    filterExpenses() {
        const search = document.getElementById('searchExpense').value.toLowerCase();
        const category = document.getElementById('categoryFilter').value;

        let filtered = this.expenses;
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
                        <button class="action-btn" onclick="app.openExpenseModal(app.expenses.find(x => x.id === '${e.id}'))">✏️</button>
                        <button class="action-btn delete" onclick="app.deleteExpense('${e.id}')">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }
    }

    // Budget
    renderBudget() {
        const now = new Date();
        const monthExpenses = this.expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        const totalSpent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
        const remaining = Math.max(0, this.budget.monthly - totalSpent);
        const percent = this.budget.monthly > 0 ? Math.min(100, (totalSpent / this.budget.monthly) * 100) : 0;

        document.getElementById('totalBudget').textContent = this.formatCurrency(this.budget.monthly);
        document.getElementById('budgetSpentAmount').textContent = this.formatCurrency(totalSpent);
        document.getElementById('budgetRemainingAmount').textContent = this.formatCurrency(remaining);
        document.getElementById('budgetSpentPercent').textContent = `${Math.round(percent)}%`;

        const ring = document.getElementById('budgetRing');
        const circumference = 2 * Math.PI * 52;
        ring.style.strokeDasharray = circumference;
        ring.style.strokeDashoffset = circumference - (percent / 100) * circumference;
        ring.style.stroke = percent > 90 ? '#ef4444' : percent > 70 ? '#f59e0b' : '#8b5cf6';

        this.renderCategoryBudgets(monthExpenses);
    }

    renderCategoryBudgets(monthExpenses) {
        const container = document.getElementById('categoryBudgetList');
        const catSpending = {};
        monthExpenses.forEach(e => { catSpending[e.category] = (catSpending[e.category] || 0) + e.amount; });

        container.innerHTML = Object.keys(this.categoryConfig).map(cat => {
            const spent = catSpending[cat] || 0;
            const limit = this.budget.categories[cat] || this.budget.monthly * 0.2;
            const percent = Math.min(100, (spent / limit) * 100);
            const config = this.categoryConfig[cat];
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

    // Analytics
    renderAnalytics() {
        this.renderTopCategories();
        this.renderInsights();
    }

    renderTopCategories() {
        const container = document.getElementById('topCategories');
        const catSpending = {};
        this.expenses.forEach(e => { catSpending[e.category] = (catSpending[e.category] || 0) + e.amount; });

        const sorted = Object.entries(catSpending).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const total = sorted.reduce((sum, [, val]) => sum + val, 0);

        container.innerHTML = sorted.map(([cat, amount]) => {
            const config = this.categoryConfig[cat];
            const percent = total > 0 ? (amount / total * 100).toFixed(1) : 0;
            return `
                <div class="category-budget-item">
                    <div class="category-budget-header">
                        <span>${config?.icon || '📦'} ${config?.name || 'Other'}</span>
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
        const container = document.getElementById('insightsGrid');
        const now = new Date();
        const thisMonth = this.expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const lastMonth = this.expenses.filter(e => {
            const d = new Date(e.date);
            const lm = new Date(now.getFullYear(), now.getMonth() - 1);
            return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
        });

        const thisTotal = thisMonth.reduce((s, e) => s + e.amount, 0);
        const lastTotal = lastMonth.reduce((s, e) => s + e.amount, 0);
        const change = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal * 100).toFixed(0) : 0;
        const highestCat = Object.entries(thisMonth.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; }, {})).sort((a, b) => b[1] - a[1])[0];

        container.innerHTML = `
            <div class="stat-card gradient-purple" style="padding: 20px;">
                <span class="stat-label">Month-over-Month</span>
                <span class="stat-value" style="font-size: 24px;">${change >= 0 ? '+' : ''}${change}%</span>
                <span class="stat-change">${change >= 0 ? 'Increase' : 'Decrease'} from last month</span>
            </div>
            <div class="stat-card gradient-blue" style="padding: 20px;">
                <span class="stat-label">Top Category</span>
                <span class="stat-value" style="font-size: 24px;">${highestCat ? this.categoryConfig[highestCat[0]]?.icon + ' ' + this.categoryConfig[highestCat[0]]?.name : 'N/A'}</span>
                <span class="stat-change">${highestCat ? this.formatCurrency(highestCat[1]) : 'No data'}</span>
            </div>
            <div class="stat-card gradient-green" style="padding: 20px;">
                <span class="stat-label">Budget Status</span>
                <span class="stat-value" style="font-size: 24px;">${thisTotal <= this.budget.monthly ? '✅ On Track' : '⚠️ Over'}</span>
                <span class="stat-change">${this.formatCurrency(Math.abs(this.budget.monthly - thisTotal))} ${thisTotal <= this.budget.monthly ? 'remaining' : 'over budget'}</span>
            </div>
        `;
    }

    // Charts
    initCharts() {
        this.initCategoryChart();
        this.initWeeklyChart();
        this.initMonthlyChart();
    }

    initCategoryChart() {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) return;
        const data = this.getCategoryData();
        this.charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: data.labels, datasets: [{ data: data.values, backgroundColor: data.colors, borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#a0aec0', padding: 15 } } }, cutout: '65%' }
        });
    }

    initWeeklyChart() {
        const ctx = document.getElementById('weeklyChart');
        if (!ctx) return;
        const data = this.getWeeklyData();
        this.charts.weekly = new Chart(ctx, {
            type: 'bar',
            data: { labels: data.labels, datasets: [{ label: 'Spending', data: data.values, backgroundColor: 'rgba(139, 92, 246, 0.5)', borderColor: '#8b5cf6', borderWidth: 2, borderRadius: 8 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0aec0' } }, x: { grid: { display: false }, ticks: { color: '#a0aec0' } } } }
        });
    }

    initMonthlyChart() {
        const ctx = document.getElementById('monthlyChart');
        if (!ctx) return;
        const data = this.getMonthlyData();
        this.charts.monthly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Monthly Spending',
                    data: data.values,
                    backgroundColor: 'rgba(168, 85, 247, 0.6)',
                    borderColor: '#A855F7',
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0aec0' } },
                    x: { grid: { display: false }, ticks: { color: '#a0aec0' } }
                }
            }
        });
    }

    updateCharts() {
        if (this.charts.category) { const d = this.getCategoryData(); this.charts.category.data.labels = d.labels; this.charts.category.data.datasets[0].data = d.values; this.charts.category.update(); }
        if (this.charts.weekly) { const d = this.getWeeklyData(); this.charts.weekly.data.labels = d.labels; this.charts.weekly.data.datasets[0].data = d.values; this.charts.weekly.update(); }
        if (this.charts.monthly) { const d = this.getMonthlyData(); this.charts.monthly.data.labels = d.labels; this.charts.monthly.data.datasets[0].data = d.values; this.charts.monthly.update(); }
    }

    getCategoryData() {
        const now = new Date();
        const monthExpenses = this.expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const catSpending = {};
        monthExpenses.forEach(e => { catSpending[e.category] = (catSpending[e.category] || 0) + e.amount; });
        const labels = [], values = [], colors = [];
        Object.entries(catSpending).forEach(([cat, val]) => {
            labels.push(this.categoryConfig[cat]?.name || 'Other');
            values.push(val);
            colors.push(this.categoryConfig[cat]?.color || '#64748b');
        });
        return { labels, values, colors };
    }

    getWeeklyData() {
        const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const values = [0, 0, 0, 0, 0, 0, 0];
        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        this.expenses.forEach(e => {
            const d = new Date(e.date);
            if (d >= startOfWeek && d <= new Date()) values[d.getDay()] += e.amount;
        });
        return { labels, values };
    }

    getMonthlyData() {
        const labels = [], values = [];
        const now = new Date();
        for (let i = 2; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            labels.push(date.toLocaleDateString('en-IN', { month: 'short' }));
            const monthTotal = this.expenses.filter(e => {
                const d = new Date(e.date);
                return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
            }).reduce((sum, e) => sum + e.amount, 0);
            values.push(monthTotal);
        }
        return { labels, values };
    }

    formatCurrency(amount) {
        return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    }

    exportToExcel() {
        if (this.expenses.length === 0) {
            this.showToast('No expenses to export!', 'error');
            return;
        }

        const data = this.expenses.map(e => ({
            'Date': new Date(e.date).toLocaleDateString('en-IN'),
            'Description': e.description,
            'Category': this.categoryConfig[e.category]?.name || 'Other',
            'Amount (₹)': e.amount,
            'Note': e.note || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');

        // Auto-width columns
        const colWidths = [{ wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 25 }];
        worksheet['!cols'] = colWidths;

        const today = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `expenses_${today}.xlsx`);
        this.showToast('Expenses exported successfully!', 'success');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // Profile Management
    renderProfile() {
        document.getElementById('profileDisplayName').textContent = this.profile.name;
        document.getElementById('profileDisplayRoom').textContent = this.profile.room;
        document.getElementById('profileAvatar').textContent = this.profile.name.charAt(0).toUpperCase();

        // Update sidebar too
        document.querySelector('.user-name').textContent = this.profile.name;
        document.querySelector('.user-status').textContent = this.profile.room;
        document.querySelector('.avatar').textContent = this.profile.name.charAt(0).toUpperCase();
    }

    toggleProfileForm(show) {
        const form = document.getElementById('profileForm');
        if (show) {
            form.classList.remove('hidden');
            document.getElementById('profileName').value = this.profile.name;
            document.getElementById('profileRoom').value = this.profile.room;
            document.getElementById('profileEmail').value = this.profile.email || '';
            document.getElementById('profilePhone').value = this.profile.phone || '';
        } else {
            form.classList.add('hidden');
        }
    }

    saveProfile() {
        this.profile.name = document.getElementById('profileName').value || 'Hostler';
        this.profile.room = document.getElementById('profileRoom').value || 'Room 404';
        this.profile.email = document.getElementById('profileEmail').value;
        this.profile.phone = document.getElementById('profilePhone').value;
        localStorage.setItem('profile', JSON.stringify(this.profile));
        this.renderProfile();
        this.toggleProfileForm(false);
        this.showToast('Profile updated!', 'success');
    }

    // Debt Management
    renderDebts() {
        const totalOwe = this.debts.filter(d => d.type === 'owe').reduce((sum, d) => sum + d.amount, 0);
        const totalOwed = this.debts.filter(d => d.type === 'owed').reduce((sum, d) => sum + d.amount, 0);

        document.getElementById('totalIOwe').textContent = this.formatCurrency(totalOwe);
        document.getElementById('totalOwedToMe').textContent = this.formatCurrency(totalOwed);

        const container = document.getElementById('debtList');
        if (this.debts.length === 0) {
            container.innerHTML = '<div class="empty-state"><h4>No debts recorded</h4><p>Track money you owe or are owed</p></div>';
            return;
        }

        container.innerHTML = this.debts.map(d => `
            <div class="debt-item">
                <div class="debt-item-left">
                    <div class="debt-item-icon ${d.type}">${d.type === 'owe' ? '📤' : '📥'}</div>
                    <div class="debt-item-info">
                        <h4>${d.person}</h4>
                        <p>${d.description || 'No description'} • ${new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    </div>
                </div>
                <div class="debt-item-right">
                    <span class="debt-item-amount ${d.type}">${d.type === 'owe' ? '-' : '+'}${this.formatCurrency(d.amount)}</span>
                    <div class="debt-actions">
                        <button class="action-btn" onclick="app.markDebtPaid('${d.id}')">✅</button>
                        <button class="action-btn delete" onclick="app.deleteDebt('${d.id}')">🗑️</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    openDebtModal(debt = null) {
        const modal = document.getElementById('debtModal');
        document.getElementById('debtForm').reset();
        document.getElementById('debtDate').valueAsDate = new Date();

        if (debt) {
            document.getElementById('debtModalTitle').textContent = 'Edit Debt';
            document.getElementById('debtId').value = debt.id;
            document.getElementById('debtPerson').value = debt.person;
            document.getElementById('debtAmount').value = debt.amount;
            document.getElementById('debtType').value = debt.type;
            document.getElementById('debtDescription').value = debt.description || '';
            document.getElementById('debtDate').value = debt.date;
        } else {
            document.getElementById('debtModalTitle').textContent = 'Add Debt Entry';
            document.getElementById('debtId').value = '';
        }
        modal.classList.add('active');
    }

    closeDebtModal() {
        document.getElementById('debtModal').classList.remove('active');
    }

    handleDebtSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('debtId').value;
        const debt = {
            id: id || Date.now().toString(),
            person: document.getElementById('debtPerson').value,
            amount: parseFloat(document.getElementById('debtAmount').value),
            type: document.getElementById('debtType').value,
            description: document.getElementById('debtDescription').value,
            date: document.getElementById('debtDate').value
        };

        if (id) {
            const index = this.debts.findIndex(d => d.id === id);
            this.debts[index] = debt;
            this.showToast('Debt updated!', 'success');
        } else {
            this.debts.unshift(debt);
            this.showToast('Debt added!', 'success');
        }

        localStorage.setItem('debts', JSON.stringify(this.debts));
        this.closeDebtModal();
        this.renderDebts();
    }

    markDebtPaid(id) {
        if (confirm('Mark this debt as paid/settled?')) {
            this.debts = this.debts.filter(d => d.id !== id);
            localStorage.setItem('debts', JSON.stringify(this.debts));
            this.renderDebts();
            this.showToast('Debt marked as paid!', 'success');
        }
    }

    deleteDebt(id) {
        if (confirm('Delete this debt entry?')) {
            this.debts = this.debts.filter(d => d.id !== id);
            localStorage.setItem('debts', JSON.stringify(this.debts));
            this.renderDebts();
            this.showToast('Debt deleted!', 'success');
        }
    }
}

const app = new ExpenseTracker();
