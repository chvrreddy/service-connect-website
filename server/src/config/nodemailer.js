// backend/src/config/nodemailer.js

const nodemailer = require('nodemailer'); 
require('dotenv').config();

// --- NODEMAILER CONFIGURATION ---
const transporter = nodemailer.createTransport({
    service: 'gmail', // Use 'gmail' for Google, or configure another SMTP host
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * @function sendEmail
 * @desc Sends an email using Nodemailer.
 */
const sendEmail = async (to, subject, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"${process.env.EMAIL_SENDER_NAME || 'Service Connect'}" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: html,
        });
        console.log('Message sent: %s', info.messageId);
    } catch (error) {
        console.error('Nodemailer Error: Failed to send email to %s', to, error.message);
        // We choose not to re-throw the error to keep the API responsive even if email fails
    }
};

module.exports = { sendEmail };