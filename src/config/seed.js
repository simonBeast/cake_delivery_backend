const Cake = require('../models/cake.model');
const User = require('../models/user.model');

const ensureUser = async ({ name, email, password, role, phone }) => {
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    return exists;
  }

  return User.create({
    name,
    email: email.toLowerCase(),
    password,
    role,
    phone,
  });
};

const ensureCake = async ({ name, description, price, isAvailable = true }) => {
  const exists = await Cake.findOne({ name });
  if (exists) {
    return exists;
  }

  return Cake.create({
    name,
    description,
    price,
    isAvailable,
  });
};

const seedDemoData = async () => {
  await ensureUser({
    name: 'Customer Demo',
    email: 'customer@cake.com',
    password: 'password123',
    role: 'CUSTOMER',
    phone: '+251911111111',
  });

  await ensureUser({
    name: 'Admin Demo',
    email: 'admin@cake.com',
    password: 'password123',
    role: 'ADMIN',
    phone: '+251922222222',
  });

  await ensureUser({
    name: 'Delivery Demo',
    email: 'delivery@cake.com',
    password: 'password123',
    role: 'DELIVERY',
    phone: '+251933333333',
  });

  await ensureCake({
    name: 'Chocolate Dream',
    description: 'Rich chocolate sponge with ganache',
    price: 14.5,
  });

  await ensureCake({
    name: 'Vanilla Berry',
    description: 'Vanilla cream and mixed berries',
    price: 12,
  });

  await ensureCake({
    name: 'Red Velvet Mini',
    description: 'Soft red velvet with cream cheese frosting',
    price: 9.25,
  });
};

module.exports = {
  seedDemoData,
};
