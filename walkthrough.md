# Phase 2 – Walkthrough

## ✅ What Was Built

### 3 Separate Pages

| URL | File | Purpose |
|-----|------|---------|
| `localhost:3000/login.html` | `login.html` | Dedicated Sign In page |
| `localhost:3000/register.html` | `register.html` | Dedicated Create Account page |
| `localhost:3000/` | `index.html` | Dashboard (protected) |

---

### Login Page (`/login.html`)
````carousel
![Login Page Design](file:///C:/Users/konda/.gemini/antigravity/brain/383edc7b-80f4-4cad-847c-bfd9d12997f6/login_page_preview_1774725570010.png)
<!-- slide -->
![Register Page Design](file:///C:/Users/konda/.gemini/antigravity/brain/383edc7b-80f4-4cad-847c-bfd9d12997f6/register_page_preview_1774725585050.png)
````

**Login page features:**
- Split layout (left: branding + features, right: form)
- Floating animated logo
- Feature showcase: Analytics, Budget, Debt Splitter, Any Device
- Clean username/password form
- Purple gradient Sign In button with hover effects

**Register page features:**
- Reversed split layout (left: form, right: step guide)
- Password strength indicator (4-bar visual)
- Green gradient theme
- Step-by-step "Get Started" guide on the right panel

### Auth Guards
- **`/login.html`** and **`/register.html`**: Redirect to `/` if user already has a token
- **`/` (dashboard)**: Has a guard script that immediately redirects to `/login.html` if no token is found
- **Logout button** (⏻): Calls the API to invalidate the session, clears localStorage, redirects to `/login.html`

---

## Navigation Flow

```mermaid
graph LR
    A["User visits /"] -->|No token| B["/login.html"]
    A -->|Has token| D["Dashboard"]
    B -->|Sign In form| D
    B -->|Click Register| C["/register.html"]
    C -->|Create Account| D
    D -->|Logout button| B
```

---

## Other Features (Also Active)
- **🔔 Notifications** — bell icon in dashboard header shows budget alerts
- **🤖 BuddyBot Chatbot** — floating 🤖 button opens AI assistant
- **💸 Budget Negative Display** — Budget Left shows **-₹X** in red when overspent
- **🤝 Expense Splitting** — Split checkbox in Add Expense auto-creates a debt
- **📱 PWA / Offline** — Installable via service worker
