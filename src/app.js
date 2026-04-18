const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const cakeRoutes = require('./routes/cake.routes');
const orderRoutes = require('./routes/order.routes');
const notificationRoutes = require('./routes/notification.routes');
const reportRoutes = require('./routes/report.routes');
const userRoutes = require('./routes/user.routes');
const errorMiddleware = require('./middleware/error.middleware');
const ApiError = require('./utils/apiError');

const app = express();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors());
app.use(helmet());
app.use(limiter);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

app.use('/auth', authRoutes);
app.use('/cakes', cakeRoutes);
app.use('/orders', orderRoutes);
app.use('/notifications', notificationRoutes);
app.use('/reports', reportRoutes);
app.use('/users', userRoutes);

app.use((_req, _res, next) => {
  next(new ApiError(404, 'Route not found'));
});

app.use(errorMiddleware);

module.exports = app;
