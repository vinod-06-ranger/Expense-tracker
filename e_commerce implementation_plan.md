# Full-Stack E-Commerce App — Implementation Plan

A complete e-commerce platform with a **FastAPI + PostgreSQL backend** and a **React + Vite + Tailwind CSS frontend**, featuring JWT auth, Stripe payments, Cloudinary image uploads, and an admin dashboard.

The project will be placed at:
- `c:\Users\konda\.gemini\antigravity\brain\fde810a2-0b65-4af5-b957-92a3ab9768b2\coderefine\ecommerce\`

---

## Proposed Changes

### Backend — `ecommerce/backend/`

#### [NEW] `requirements.txt`
All Python dependencies: fastapi, uvicorn, sqlalchemy, psycopg2-binary, python-jose, passlib[bcrypt], alembic, stripe, cloudinary, python-dotenv, pydantic[email].

#### [NEW] `app/database.py`
SQLAlchemy engine + session factory + `Base` declarative base. Reads `DATABASE_URL` from `.env`.

#### [NEW] `app/models/` — ORM models
- `user.py` — User (id, email, hashed_password, is_admin, created_at)
- `product.py` — Product (id, name, description, price, stock, images JSON, category_id)
- `category.py` — Category (id, name)
- `cart.py` — Cart + CartItem (user_id, product_id, quantity)
- `order.py` — Order + OrderItem (user_id, status, stripe_payment_id, total)

#### [NEW] `app/schemas/` — Pydantic schemas
Request/response models for all entities (auth, product, cart, order, admin).

#### [NEW] `app/services/` — Business logic
- `auth_service.py` — password hashing, JWT create/verify
- `product_service.py` — search, filter, sort
- `cart_service.py` — cart CRUD
- `order_service.py` — order placement
- `stripe_service.py` — create checkout session, handle webhook
- `cloudinary_service.py` — upload image

#### [NEW] `app/routes/` — FastAPI routers
- `auth.py` — POST /auth/register, POST /auth/login
- `products.py` — GET /products, GET /products/{id}, POST/PUT/DELETE (admin)
- `categories.py` — GET /categories
- `cart.py` — GET/POST/PUT/DELETE /cart
- `orders.py` — POST /orders, GET /orders/me, GET /orders/{id}, PUT /orders/{id}/status (admin)
- `admin.py` — GET /admin/stats, user/product/order management
- `payments.py` — POST /payments/create-checkout-session, POST /payments/webhook
- `uploads.py` — POST /uploads/image

#### [NEW] `app/main.py`
FastAPI app factory: CORS, routers registered, startup DB init.

#### [NEW] `.env` (template)
```
DATABASE_URL=postgresql://user:password@localhost/ecommerce
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

#### [NEW] `alembic/` — Migrations
`alembic init` + configured `env.py` + initial migration.

---

### Frontend — `ecommerce/frontend/`

#### [NEW] Vite + React project scaffold
`npm create vite@latest frontend -- --template react`

#### [NEW] `tailwind.config.js` + `postcss.config.js`
Tailwind CSS configured with content paths.

#### [NEW] `src/api/axiosInstance.js`
Axios base URL + request interceptor adding `Authorization: Bearer <token>` from localStorage.

API service files:
- `authApi.js`, `productsApi.js`, `cartApi.js`, `ordersApi.js`, `adminApi.js`, `paymentApi.js`

#### [NEW] `src/store/` — Redux Toolkit
- `store.js` — root store
- `authSlice.js` — user, token, login/logout actions, localStorage persistence
- `cartSlice.js` — items[], add/remove/update/clear, localStorage persistence

#### [NEW] `src/components/`
- `Navbar.jsx` — logo, nav links, cart icon with badge, user menu
- `ProductCard.jsx` — image, name, price, add-to-cart button
- `CategorySidebar.jsx` — category filter
- `CartItem.jsx` — product row with quantity controls
- `ProtectedRoute.jsx` — redirect to login if not authenticated
- `AdminRoute.jsx` — redirect if not admin
- `ImageGallery.jsx` — main image + thumbnail strip
- `OrderStatusBadge.jsx` — colored badge for status
- `AdminStatsCard.jsx` — metric card for dashboard

#### [NEW] `src/pages/`
- `HomePage.jsx` — hero banner, featured categories, trending products
- `ProductListPage.jsx` — grid of ProductCards, search bar, category filter, price sort
- `ProductDetailPage.jsx` — ImageGallery, product info, add to cart
- `CartPage.jsx` — CartItem list, subtotal, checkout button
- `CheckoutPage.jsx` — Stripe Elements, order summary
- `PaymentSuccessPage.jsx` / `PaymentFailurePage.jsx`
- `LoginPage.jsx` / `RegisterPage.jsx` — forms with validation
- `OrderHistoryPage.jsx` — table of past orders with status
- `AdminDashboard.jsx` — tabs: Stats, Products, Users, Orders

#### [NEW] `src/App.jsx`
React Router with all routes, ProtectedRoute wrappers.

---

## Verification Plan

### Automated (Backend)
```bash
cd ecommerce/backend
uvicorn app.main:app --reload --port 8000
# Then open http://localhost:8000/docs — Swagger UI should show all routes
```

### Automated (Frontend)
```bash
cd ecommerce/frontend
npm run dev
# App should load at http://localhost:5173
```

### Manual Verification Steps
1. **Register** a new user via `/auth/register` or the Register page.
2. **Login** and confirm token is stored, Navbar shows authenticated state.
3. **Browse products** — search, filter by category, sort by price.
4. **Add to cart** — confirm Redux state + localStorage persistence.
5. **Checkout** — Stripe test card `4242 4242 4242 4242` → success page.
6. **Order history** — confirm order appears with `Pending` status.
7. **Admin login** → AdminDashboard loads, can update order status.
8. **Image upload** via Cloudinary on product create/edit (admin).
