const { Server } = require('socket.io');

let io;

const roomNames = {
  admin: 'room:admin',
  delivery: 'room:delivery',
  user: (userId) => `room:user:${userId}`,
};

const getEntityId = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    if (value._id) {
      return value._id.toString();
    }

    if (value.id) {
      return value.id.toString();
    }
  }

  return value.toString ? value.toString() : null;
};

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('join:user_room', ({ userId } = {}) => {
      if (userId) {
        socket.join(roomNames.user(userId));
      }
    });

    socket.on('join:admin_room', () => {
      socket.join(roomNames.admin);
    });

    socket.on('join:delivery_room', () => {
      socket.join(roomNames.delivery);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    return null;
  }

  return io;
};

const emitOrderCreated = (order) => {
  const socket = getIO();
  if (!socket) {
    return;
  }
  const payload = { order };
  const customerId = getEntityId(order.customer);

  socket.to(roomNames.admin).emit('order:created', payload);
  if (customerId) {
    socket.to(roomNames.user(customerId)).emit('order:created', payload);
  }
};

const emitOrderStatusUpdated = (order) => {
  const socket = getIO();
  if (!socket) {
    return;
  }
  const payload = { order };

  const customerId = getEntityId(order.customer);
  const deliveryId = getEntityId(order.deliveryPerson);

  socket.to(roomNames.admin).emit('order:status_updated', payload);
  if (customerId) {
    socket.to(roomNames.user(customerId.toString())).emit('order:status_updated', payload);
  }
  if (deliveryId) {
    socket.to(roomNames.user(deliveryId.toString())).emit('order:status_updated', payload);
  }
};

const emitOrderAssigned = (order) => {
  const socket = getIO();
  if (!socket) {
    return;
  }
  const payload = { order };

  const customerId = getEntityId(order.customer);
  const deliveryId = getEntityId(order.deliveryPerson);

  socket.to(roomNames.admin).emit('order:assigned', payload);
  if (customerId) {
    socket.to(roomNames.user(customerId.toString())).emit('order:assigned', payload);
  }
  if (deliveryId) {
    socket.to(roomNames.user(deliveryId.toString())).emit('order:assigned', payload);
  }
};

const emitOrderDelivered = (order) => {
  const socket = getIO();
  if (!socket) {
    return;
  }
  const payload = { order };

  const customerId = getEntityId(order.customer);
  const deliveryId = getEntityId(order.deliveryPerson);

  socket.to(roomNames.admin).emit('order:delivered', payload);
  if (customerId) {
    socket.to(roomNames.user(customerId.toString())).emit('order:delivered', payload);
  }
  if (deliveryId) {
    socket.to(roomNames.user(deliveryId.toString())).emit('order:delivered', payload);
  }
};

const emitOrderPaymentUpdated = (order) => {
  const socket = getIO();
  if (!socket) {
    return;
  }
  const payload = { order };

  const customerId = getEntityId(order.customer);
  const deliveryId = getEntityId(order.deliveryPerson);

  socket.to(roomNames.admin).emit('order:payment_updated', payload);
  if (customerId) {
    socket.to(roomNames.user(customerId.toString())).emit('order:payment_updated', payload);
  }
  if (deliveryId) {
    socket.to(roomNames.user(deliveryId.toString())).emit('order:payment_updated', payload);
  }
};

const emitNotificationCreated = (notification) => {
  const socket = getIO();
  if (!socket) {
    return;
  }

  const recipientId = getEntityId(notification.recipient);
  if (!recipientId) {
    return;
  }

  socket.to(roomNames.user(recipientId.toString())).emit('notification:new', {
    notification,
  });
};

module.exports = {
  initSocket,
  getIO,
  roomNames,
  emitOrderCreated,
  emitOrderStatusUpdated,
  emitOrderAssigned,
  emitOrderDelivered,
  emitOrderPaymentUpdated,
  emitNotificationCreated,
};
