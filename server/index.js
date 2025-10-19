// backend/index.js (The new server core file)

const express = require('express');
const cors = require('cors');
const path = require('path'); 
require('dotenv').config();

// --- Configuration & Middleware ---
const pool = require('./src/config/db'); // Test connection runs on import
// Multer is still defined here for global access and static file configuration
const multer = require('multer'); 

const app = express();

// CRITICAL FIX: CORS MIDDLEWARE 
app.use(cors({
    origin: 'http://localhost:3000'
}));

app.use(express.json());


// --- STATIC FILES / GLOBAL FILE UPLOAD CONFIGURATION (Needed for serving /uploads) ---

// NOTE: This storage configuration is re-used in userRoutes, customerRoutes, and bookingRoutes
// to ensure file naming consistency across modules.
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Use user ID and a timestamp to ensure unique names
        const ext = path.extname(file.originalname);
        // Ensure req.user.id exists before using it, fallback to 'public' if not authed yet
        // NOTE: We trust that auth middleware will run before upload in private routes
        const userId = req.user?.id || 'public'; 
        cb(null, `${userId}-${Date.now()}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    // Note: fileFilter is handled within the route files (userRoutes, customerRoutes, bookingRoutes)
});

// Serve files from the 'uploads' directory statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// ------------------------------------------------------------------------


// --- ROUTE MOUNTING ---
// NOTE: We require auth middleware once here for reference, though it's used inside the route files.
// const auth = require('./middleware/auth'); 

// 1. Public Routes (Includes / and /services, /providers, /contact-us)
app.use('/api/v1', require('./src/routes/publicRoutes'));

// 2. Authentication Routes
app.use('/api/v1/auth', require('./src/routes/authRoutes'));

// 3. Shared User/Profile Routes (Includes wallet, unread-messages, profile update)
app.use('/api/v1', require('./src/routes/userRoutes'));

// 4. Booking and Chat Routes (Includes POST /bookings and PUT /bookings/:id)
app.use('/api/v1', require('./src/routes/bookingRoutes'));

// 5. Customer Specific Routes (Includes /customer/bookings and deposit-request)
app.use('/api/v1', require('./src/routes/customerRoutes'));

// 6. Provider Specific Routes (Includes /provider/earnings, /provider/profile, withdrawal-request)
app.use('/api/v1', require('./src/routes/providerRoutes'));

// 7. Payment & Review Routes
app.use('/api/v1', require('./src/routes/paymentRoutes'));

// 8. Admin Routes (Secured internally by role check in the router)
app.use('/api/v1', require('./src/routes/adminRoutes'));


// // --- SERVER START ---
// const PORT = process.env.PORT || 3001; 

// app.listen(PORT, () => {
//     console.log(`Server is running at http://localhost:${PORT}`); 
//     console.log(`Nodemailer is configured for: ${process.env.EMAIL_USER}`);

// Use the PORT environment variable provided by Render, 
// or default to 10000 for local testing.
const PORT = process.env.PORT || 10000; 

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
