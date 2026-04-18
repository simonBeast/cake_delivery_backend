# Cake Delivery Backend

Production-ready Express + MongoDB API for a multi-role cake delivery system.

It supports:
- JWT auth with role-based permissions
- Email verification + password reset via SMTP
- Cake catalog and image uploads
- Order lifecycle management
- Real-time updates (Socket.IO)
- Notification center
- Analytics summary for admin dashboard

## 1. Stack

- Node.js + Express
- MongoDB + Mongoose
- JWT + bcryptjs
- Joi validation
- Multer file uploads
- Nodemailer SMTP
- Socket.IO

## 2. Quick Start

### Prerequisites

- Node.js 18+
- MongoDB running locally or in cloud

### Install and run

```bash
npm install
```

Create `.env` from `.env.example` (Windows PowerShell):

```powershell
Copy-Item .env.example .env
```

Start in development mode:

```bash
npm run dev
```

Server default URL:

```text
http://localhost:4000
```

Health check:

```text
GET /health
```

## 3. Environment Variables

Required values:

- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Gmail setup:

- `SMTP_USER`: your Gmail address
- `SMTP_PASS`: Gmail App Password

The mailer normalizes app passwords with spaces automatically, so both `abcd efgh ijkl mnop` and `abcdefghijklmnop` work.

## 4. Seeded Demo Data

On startup, the backend seeds demo users and cakes if they do not exist.

Users:

- CUSTOMER: `customer@cake.com` / `password123`
- ADMIN: `admin@cake.com` / `password123`
- DELIVERY: `delivery@cake.com` / `password123`

Seed logic is in `src/config/seed.js`.

## 5. API Overview

All protected endpoints require:

```text
Authorization: Bearer <token>
```

### Auth

- `POST /auth/register`
	- Creates or updates an unverified account
	- Sends email verification code
- `POST /auth/verify-email`
	- Verifies code and returns JWT + user
- `POST /auth/login`
	- Blocks unverified accounts
- `POST /auth/forgot-password`
	- Sends reset code by email
- `POST /auth/reset-password`
	- Resets password using email + code

### Cakes

- `GET /cakes`
- `POST /cakes` (ADMIN)
- `PUT /cakes/:id` (ADMIN)
- `DELETE /cakes/:id` (ADMIN)

Upload fields supported:

- `images` (multiple)
- `image` (legacy single)

Static images are served from:

```text
/uploads
```

### Orders

- `POST /orders` (CUSTOMER)
- `GET /orders` (ADMIN)
- `GET /orders/my` (CUSTOMER)
- `GET /orders/delivery` (DELIVERY)
- `PUT/PATCH /orders/:id/status` (ADMIN)
- `PUT/PATCH /orders/:id/assign` (ADMIN)
- `PUT /orders/:id/deliver` (DELIVERY)
- `PATCH /orders/:id/payment` (CUSTOMER, ADMIN)
- `PATCH /orders/:id/feedback` (CUSTOMER)

### Notifications

- `GET /notifications`
- `GET /notifications/unread-count`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`

### Reports

- `GET /reports/summary` (ADMIN)

### Users

- `GET /users/me`
- `PUT /users/me`
- `GET /users` (ADMIN)
- `POST /users` (ADMIN)
- `PUT /users/:id` (ADMIN)
- `DELETE /users/:id` (ADMIN)
- `GET /users/delivery` (ADMIN)

## 6. Real-Time Events (Socket.IO)

Client joins rooms with:

- `join:user_room`
- `join:admin_room`
- `join:delivery_room`

Order events emitted:

- `order:created`
- `order:status_updated`
- `order:assigned`
- `order:delivered`
- `order:payment_updated`

Notification event emitted:

- `notification:new`

Implementation is in `src/realtime/socket.js`.

## 7. How the Code Is Organized

```text
src/
	app.js                    # Express app, security middleware, route mounting
	server.js                 # DB connect, seed, HTTP server, Socket.IO bootstrap
	config/
		db.js                   # MongoDB connection
		seed.js                 # demo seed users/cakes
	controllers/              # request handlers
	middleware/
		auth.middleware.js      # JWT auth
		role.middleware.js      # role checks
		validateRequest.middleware.js
		upload.middleware.js
		error.middleware.js     # centralized error response
	models/                   # Mongoose schemas
	routes/                   # route definitions per domain
	validators/               # Joi request schemas
	realtime/
		socket.js               # socket room/event wiring
	utils/
		apiError.js
		catchAsync.js
		pagination.js
		mailer.js               # SMTP utility for verification/reset emails
	uploads/
```

## 8. Auth and Email Flow (Detailed)

1. `POST /auth/register`
2. Backend stores hashed verification code + expiry on user
3. Backend sends code by SMTP
4. User submits code to `POST /auth/verify-email`
5. Backend marks `emailVerified=true` and issues JWT

Password reset follows the same pattern with a reset code and expiry.

## 9. Notes and Troubleshooting

- If email is not sending, verify SMTP values and Gmail App Password.
- Ensure MongoDB URI is reachable from your machine.
- If uploads fail, confirm request is `multipart/form-data`.
- If JWT fails, ensure `JWT_SECRET` is set and unchanged between restarts.

---

If you also run the React Native app, read `../mobile-app/README.md` for frontend setup and integration details.
