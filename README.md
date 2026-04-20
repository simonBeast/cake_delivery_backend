# Cake Delivery Backend

Express + MongoDB API for the Cake Delivery platform. The backend powers authentication, order management, cake catalog management, reporting, notifications, uploads, and realtime updates for the mobile app.

## 1. What the Backend Covers

- JWT auth with role-based permissions for CUSTOMER, ADMIN, and DELIVERY users.
- Email verification and password recovery using SMTP.
- Cake catalog CRUD with image uploads and availability toggles.
- Cart-style order creation with scheduled delivery, payment metadata, and feedback.
- Delivery-side payment proof submission with image evidence.
- Admin payment review queue with explicit approve and reject actions.
- Payment audit trail with proof versioning and rejection reasons.
- Notification persistence and unread counts.
- Admin reporting with period filters and delivery performance data.
- Socket.IO events for live order and notification updates.

## 2. Stack

- Node.js + Express 
- MongoDB + Mongoose
- JWT + bcryptjs
- Joi validation
- Multer file uploads
- Nodemailer SMTP
- Socket.IO
- Helmet, CORS, and express-rate-limit for basic hardening

## 3. Quick Start

### Prerequisites

- Node.js 18+
- MongoDB available locally or in the cloud

### Install and run

```bash
npm install
```

Create `.env` from `.env.example` in PowerShell:

```powershell
Copy-Item .env.example .env
```

Start the server in development mode:

```bash
npm run dev
```

Default server URL:

```text
http://localhost:4000
```

Health check:

```text
GET /health
```

## 4. Environment Variables

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
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Gmail setup:

- `SMTP_USER`: your Gmail address
- `SMTP_PASS`: your Gmail App Password

The mailer normalizes spaces in app passwords automatically, so both grouped and ungrouped values work.

Cloudinary setup (recommended for production image persistence):

- `CLOUDINARY_CLOUD_NAME`: your Cloudinary cloud name
- `CLOUDINARY_API_KEY`: Cloudinary API key
- `CLOUDINARY_API_SECRET`: Cloudinary API secret

If Cloudinary variables are configured, cake images and payment proof images are uploaded to Cloudinary and stored as durable HTTPS URLs. If not configured, uploads fallback to local `/uploads` storage.

## 5. Seeded Demo Data

The backend seeds demo users and sample cakes on startup if they do not already exist.

Demo users:

- CUSTOMER: `customer@cake.com` / `password123`
- ADMIN: `admin@cake.com` / `password123`
- DELIVERY: `delivery@cake.com` / `password123`

Seed logic lives in `src/config/seed.js`.

## 6. API Overview

All protected endpoints require:

```text
Authorization: Bearer <token>
```

### Auth

- `POST /auth/register`
	- Creates or refreshes an unverified account state
	- Sends a verification code by email
- `POST /auth/verify-email`
	- Verifies the code and returns JWT plus user data
- `POST /auth/login`
	- Rejects unverified accounts
- `POST /auth/forgot-password`
	- Sends a reset code by email
- `POST /auth/reset-password`
	- Resets the password using email, code, and new password

### Cakes

- `GET /cakes`
- `POST /cakes` (ADMIN)
- `PUT /cakes/:id` (ADMIN)
- `DELETE /cakes/:id` (ADMIN)

Supported catalog behaviors include search, filtering, pagination, image uploads, and availability updates.

Upload fields:

- `images` for multiple files
- `image` for the legacy single-image flow

Static uploads are served from:

```text
/uploads
```

### Orders

- `POST /orders` (CUSTOMER)
- `GET /orders` (ADMIN)
- `GET /orders/my` (CUSTOMER)
- `GET /orders/delivery` (DELIVERY)
- `PUT /PATCH /orders/:id/status` (ADMIN)
- `PUT /PATCH /orders/:id/assign` (ADMIN)
- `PUT /orders/:id/deliver` (DELIVERY)
- `PATCH /orders/:id/delivered` (DELIVERY alias)
- `PATCH /orders/:id/payment` (ADMIN)
- `PATCH /orders/:id/payment/proof` (DELIVERY, multipart form with `proofImage`)
- `PATCH /orders/:id/payment/review` (ADMIN, `APPROVE` or `REJECT`)
- `PATCH /orders/:id/feedback` (CUSTOMER)

Orders now support cart-style item arrays, scheduled delivery time, payment method tracking, and post-delivery feedback.

Payment workflow details:

- Initial payment status is `PENDING_PROOF` when an order is created.
- Delivery user submits payment proof with transaction reference and image, moving status to `SUBMITTED`.
- Admin reviews submitted proof:
	- `APPROVE` -> payment status becomes `PAID`
	- `REJECT` -> payment status becomes `REJECTED` and stores a rejection reason
- Rejected proofs can be re-submitted by delivery users with incremented proof version.
- Orders cannot be marked delivered until payment status is `SUBMITTED` or `PAID`.
- Payment method changes are tracked in payment audit history and reset pending proof fields.

Delivery assignment safeguard:

- A delivery user can be blocked from new assignments if they have too many unresolved payment proofs older than 24 hours.

### Notifications

- `GET /notifications`
- `GET /notifications/unread-count`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`

### Reports

- `GET /reports/summary` (ADMIN)

The summary endpoint accepts a `period` query parameter with `today`, `week`, `month`, `quarter`, or `year`.

### Users

- `GET /users/me`
- `PUT /users/me`
- `GET /users` (ADMIN)
- `POST /users` (ADMIN)
- `PUT /users/:id` (ADMIN)
- `DELETE /users/:id` (ADMIN)
- `GET /users/delivery` (ADMIN)

## 7. Realtime Events

Socket.IO room joins:

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

The realtime wiring is in `src/realtime/socket.js`, and notifications are created through `src/services/notification.service.js`.

## 8. Project Structure

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
	services/                 # domain services such as notifications
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

## 9. Auth and Email Flow

1. `POST /auth/register`
2. The backend stores a hashed verification code and expiry on the user record.
3. A verification email is sent through SMTP.
4. The client submits the code to `POST /auth/verify-email`.
5. The backend marks the account verified and issues a JWT.

Password reset follows the same pattern with a reset code and expiry.

## 10. Notes and Troubleshooting

- If email is not sending, verify the SMTP configuration and Gmail App Password.
- Ensure the MongoDB URI is reachable from your machine.
- If uploads fail, confirm the request uses `multipart/form-data`.
- If JWT validation fails, confirm `JWT_SECRET` is set and has not changed between restarts.

---

If you also run the React Native app, read `../mobile-app/README.md` for frontend setup and integration details.
