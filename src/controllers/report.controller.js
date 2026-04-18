const Order = require('../models/order.model');
const catchAsync = require('../utils/catchAsync');

const getPeriodStart = (period) => {
  const now = new Date();
  const start = new Date(now);

  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === 'week') {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === 'quarter') {
    const quarterStartMonth = Math.floor(start.getMonth() / 3) * 3;
    start.setMonth(quarterStartMonth, 1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  start.setMonth(0, 1);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getSummary = catchAsync(async (req, res) => {
  const period = req.query?.period || 'month';
  const fromDate = getPeriodStart(period);
  const periodFilter = { createdAt: { $gte: fromDate } };

  const lifetimeTotalOrders = await Order.countDocuments();

  const totalOrders = await Order.countDocuments(periodFilter);
  const deliveredOrders = await Order.countDocuments({
    ...periodFilter,
    status: 'DELIVERED',
  });
  const pendingOrders = await Order.countDocuments({
    ...periodFilter,
    status: { $in: ['PENDING', 'PREPARING', 'OUT_FOR_DELIVERY'] },
  });
  const declinedOrders = await Order.countDocuments({
    ...periodFilter,
    status: 'DECLINED',
  });

  const revenueAgg = await Order.aggregate([
    {
      $match: {
        status: 'DELIVERED',
        ...periodFilter,
      },
    },
    { $group: { _id: null, total: { $sum: '$totalPrice' } } },
  ]);

  const totalRevenue = revenueAgg[0]?.total || 0;

  const ordersByStatusAgg = await Order.aggregate([
    {
      $match: {
        ...periodFilter,
      },
    },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const dailyOrders = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: fromDate },
      },
    },
    {
      $group: {
        _id: {
          day: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.day': 1 } },
  ]);

  const topSellingCakes = await Order.aggregate([
    {
      $match: {
        ...periodFilter,
      },
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.cake',
        totalQuantity: { $sum: '$items.quantity' },
      },
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'cakes',
        localField: '_id',
        foreignField: '_id',
        as: 'cake',
      },
    },
    { $unwind: '$cake' },
    {
      $project: {
        _id: 0,
        cakeId: '$cake._id',
        cakeName: '$cake.name',
        totalQuantity: 1,
      },
    },
  ]);

  const deliveryPerformance = await Order.aggregate([
    {
      $match: {
        ...periodFilter,
        deliveryPerson: { $ne: null },
      },
    },
    {
      $group: {
        _id: '$deliveryPerson',
        assignedOrders: { $sum: 1 },
        deliveredOrders: {
          $sum: {
            $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0],
          },
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'deliveryUser',
      },
    },
    { $unwind: '$deliveryUser' },
    {
      $project: {
        _id: 0,
        deliveryPersonId: '$deliveryUser._id',
        name: '$deliveryUser.name',
        email: '$deliveryUser.email',
        assignedOrders: 1,
        deliveredOrders: 1,
      },
    },
    { $sort: { deliveredOrders: -1, assignedOrders: -1 } },
  ]);

  const periodOrderHistory = await Order.find(periodFilter)
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('customer', 'name email')
    .populate('deliveryPerson', 'name email')
    .populate('items.cake', 'name');

  const ordersByStatus = ordersByStatusAgg.map((item) => ({
    status: item._id,
    count: item.count,
  }));

  return res.json({
    success: true,
    data: {
      totalOrders,
      deliveredOrders,
      pendingOrders,
      lifetimeTotalOrders,
      totalRevenue,
      period,
      periodStart: fromDate,
      declinedOrders,
      ordersByStatus,
      dailyOrders: dailyOrders.map((item) => ({
        date: item._id.day,
        count: item.count,
      })),
      topSellingCakes,
      deliveryPerformance,
      periodOrderHistory,
    },
  });
});

module.exports = {
  getSummary,
};
