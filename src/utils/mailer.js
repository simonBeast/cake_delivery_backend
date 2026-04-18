const nodemailer = require('nodemailer');

const toBoolean = (value) => String(value || '').toLowerCase() === 'true';

const isMailerConfigured = () => {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
};

let transporter;

const getTransporter = () => {
  if (!isMailerConfigured()) {
    return null;
  }

  if (transporter) {
    return transporter;
  }

  const secure = process.env.SMTP_SECURE
    ? toBoolean(process.env.SMTP_SECURE)
    : true;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || (secure ? 465 : 587)),
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: String(process.env.SMTP_PASS || '').replace(/\s+/g, ''),
    },
  });

  return transporter;
};

const sendEmail = async ({ to, subject, text, html }) => {
  const mailer = getTransporter();

  if (!mailer) {
    return false;
  }

  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });

  return true;
};

module.exports = {
  isMailerConfigured,
  sendEmail,
};
