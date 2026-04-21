require('dotenv').config();
const http = require('http');

const app = require('./app');
const connectDB = require('./config/db');
const { seedDemoData } = require('./config/seed');
const { initSocket } = require('./realtime/socket');

const PORT = process.env.PORT || 4000;

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

const startServer = async () => {
  await connectDB();
  // await seedDemoData();

  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, '0.0.0.0',() => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
