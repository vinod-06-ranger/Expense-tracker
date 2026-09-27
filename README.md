# HostelBuddy – Expense Tracker 💰

A full-stack web application for managing hostel and personal expenses. HostelBuddy lets users record expenses, manage monthly budgets, track debts, view spending analytics, and interact with an AI financial assistant.

## ✨ Features

- 🔐 **User Authentication** – Registration, login, logout, and session-based access control
- 💸 **Expense Management** – Add, edit, delete, search, and filter expenses
- 🎯 **Budget Management** – Set a monthly budget and category-wise limits
- 📊 **Analytics Dashboard** – View total spending, remaining budget, transaction count, daily average, category breakdowns, and spending trends
- 🤝 **Debt Tracker** – Track money you owe and money owed to you
- 🤖 **BuddyBot AI Assistant** – Ask questions about your spending and budget using Google Gemini
- 📥 **Data Export** – Export expense data for further analysis
- 📱 **Responsive Interface** – Designed for convenient use on desktop and smaller screens
- ⚡ **PWA Support** – Includes a service worker and web app manifest

## 🛠️ Tech Stack

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript
- Chart.js
- SheetJS

### Backend
- Node.js
- Express.js
- REST API
- CORS
- dotenv

### AI
- Google Gemini API

### Data Storage
- JSON-based local data storage

## 🏗️ Architecture

```
Browser
   ↓
HTML / CSS / JavaScript
   ↓
Express.js REST API
   ↓
JSON data store

AI Chat
   ↓
Express.js
   ↓
Google Gemini API
```

## 📁 Project Structure

```
HostelBuddy/
├── index.html
├── login.html
├── register.html
├── styles.css
├── app.js
├── server.js
├── data.json
├── manifest.json
├── sw.js
├── package.json
├── render.yaml
├── activity_diagram.html
├── sequence_diagram.html
├── tympass_usercase_daigram.html
├── walkthrough.md
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or later
- npm

### 1. Clone the repository

```bash
git clone https://github.com/vinod-06-ranger/Expense-tracker.git
cd Expense-tracker
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
PORT=3000
PASSWORD_SALT=change_this_to_a_random_value
GEMINI_API_KEY=your_gemini_api_key
```

**Never commit your real API key or other secrets to GitHub.**

### 4. Start the application

```bash
npm start
```

Open:

```
http://localhost:3000
```

## 🔌 Main API Routes

### Authentication

- `POST /api/register` – Create a user account
- `POST /api/login` – Authenticate a user
- `POST /api/logout` – End the current session

### Expenses

- `GET /api/expenses`
- `POST /api/expenses`
- `PUT /api/expenses/:id`
- `DELETE /api/expenses/:id`

### Budget

- `GET /api/budget`
- `PUT /api/budget`

### Debts

- `GET /api/debts`
- `POST /api/debts`
- `PUT /api/debts/:id`
- `DELETE /api/debts/:id`

### AI Assistant

- `POST /api/chat` – Sends authenticated user spending context to Gemini and returns a financial-assistant response

## 🔐 Security Notes

This project is intended as a learning/portfolio project and is **not production-ready financial software**.

Important considerations include:

- Keep API keys in environment variables.
- Do not commit `.env` files.
- Use a strong random `PASSWORD_SALT`.
- The current JSON-based storage is suitable for learning and small-scale use, not production workloads.
- Authentication and password handling would need additional hardening before production deployment.

## 🎯 What I Learned

This project helped me work with:

- Building a client-server web application
- Designing and consuming REST APIs
- Authentication and authorization flows
- CRUD operations
- Managing application state in JavaScript
- Data visualization with charts
- Environment variables and API integration
- Integrating an LLM into a web application
- Structuring and documenting a software project

## 🔮 Future Improvements

- [ ] Replace JSON storage with a database such as PostgreSQL or MongoDB
- [ ] Improve authentication and session security
- [ ] Add automated tests
- [ ] Add stronger input validation
- [ ] Add recurring transactions
- [ ] Improve analytics and reporting
- [ ] Add deployment documentation
- [ ] Improve accessibility

## 👨‍💻 Author

**Vinod Kumar**  
B.Tech Computer Science Engineering Student

## 📄 License

This project is available for educational and portfolio purposes.
