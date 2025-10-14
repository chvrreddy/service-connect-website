const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors'); // Import CORS middleware
require('dotenv').config();

// NOTE: Assumes 'middleware/auth.js' exists and handles JWT verification and attaches req.user
const auth = require('./middleware/auth'); 

const app = express();

// --- CRITICAL FIX: CORS MIDDLEWARE ---
// Allows your React frontend (running on a different port, e.g., 3000) 
// to make requests to this backend (running on port 3001).
// Remove this if deploying both frontend/backend to the same domain/port in production.
app.use(cors({
    origin: 'http://localhost:3000' // Change this if your frontend port is different
}));
// ------------------------------------

app.use(express.json());

// --- DATABASE CONFIGURATION ---
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT, 
});

// Test database connection (Logs to console)
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        // If this fails, check your .env file and PostgreSQL server status.
        console.error('Database connection failed:', err);
    } else {
        console.log('Database connected successfully!');
    }
});

// --- HELPER FUNCTIONS ---

// Haversine formula to calculate distance between two lat/lon points (in kilometers)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
};

// Function to generate a random 6-digit OTP
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};


// --- PUBLIC ROUTES ---

/**
 * @route GET /
 * @desc Server status check
 * @access Public
 */
app.get('/', (req, res) => {
    res.send('Welcome to the ServiceHub Backend API!');
});

/**
 * @route GET /api/v1/services
 * @desc List all available service categories
 * @access Public
 */
app.get('/api/v1/services', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, description, icon_url FROM services ORDER BY name');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Service listing error:', err);
        res.status(500).json({ error: 'Failed to fetch services.' });
    }
});

/**
 * @route GET /api/v1/providers
 * @desc List and filter providers by service ID and location/radius
 * @access Public
 */
app.get('/api/v1/providers', async (req, res) => {
    const { service_id, lat, lon } = req.query;

    if (!service_id || !lat || !lon) {
        return res.status(400).json({ error: 'Service ID, latitude, and longitude are required for search.' });
    }

    try {
        // Find providers verified for the requested service
        const query = `
            SELECT p.* FROM providers p
            JOIN provider_services ps ON p.id = ps.provider_id
            WHERE ps.service_id = $1 AND p.is_verified = TRUE;
        `;
        const result = await pool.query(query, [service_id]);

        // Calculate distance and filter by the provider's service radius
        const customerLat = parseFloat(lat);
        const customerLon = parseFloat(lon);

        const filteredProviders = result.rows.map(provider => {
            const distance = calculateDistance(
                customerLat, 
                customerLon, 
                parseFloat(provider.location_lat), 
                parseFloat(provider.location_lon)
            );
            return {
                ...provider,
                distance_km: Math.round(distance * 10) / 10 // Round to 1 decimal place
            };
        }).filter(provider => 
            provider.distance_km <= provider.service_radius_km
        ).sort((a, b) => a.distance_km - b.distance_km); // Sort nearest first

        res.status(200).json({
            message: `${filteredProviders.length} providers found in your area.`,
            providers: filteredProviders
        });

    } catch (err) {
        console.error('Provider search error:', err);
        res.status(500).json({ error: 'An error occurred during provider search.' });
    }
});


// --- AUTHENTICATION ROUTES ---

/**
 * @route POST /api/v1/auth/register
 * @desc Create a new user (customer, provider, or admin)
 * @access Public
 */
app.post('/api/v1/auth/register', async (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ error: 'Email, password, and role are required.' });
    }
    if (!['customer', 'provider', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role specified.' });
    }

    try {
        // Check if the email already exists
        const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(409).json({ error: 'Email already exists.' });
        }

        // Hash the password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Start a database transaction
        await pool.query('BEGIN');

        // Insert the new user
        const userInsert = await pool.query(
            'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
            [email, passwordHash, role]
        );
        const user_id = userInsert.rows[0].id;

        // If user is a provider, create an initial provider profile
        if (role === 'provider') {
            // Note: Location coordinates are placeholders; provider must update them in setup page.
            await pool.query(
                'INSERT INTO providers (user_id, display_name, bio, location_lat, location_lon, service_radius_km) VALUES ($1, $2, $3, $4, $5, $6)',
                [user_id, `New Provider ${user_id}`, 'A dedicated service provider.', 0, 0, 10]
            );
        }

        await pool.query('COMMIT');

        res.status(201).json({ 
            message: 'User registered successfully.', 
            user_id: user_id,
            role: role
        });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Registration error:', err);
        res.status(500).json({ error: 'An error occurred during registration.' });
    }
});

/**
 * @route POST /api/v1/auth/login
 * @desc Authenticate and log in a user
 * @access Public
 */
app.post('/api/v1/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        // 1. Find the user by email
        const userResult = await pool.query('SELECT id, password_hash, role FROM users WHERE email = $1', [email]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // 2. Compare the provided password with the stored hash
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // 3. Generate a JWT token
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };
        
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ 
            message: 'Login successful.', 
            token,
            user_id: user.id,
            role: user.role 
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'An error occurred during login.' });
    }
});

/**
 * @route GET /api/v1/user/profile
 * @desc Get authenticated user profile data
 * @access Private
 */
app.get('/api/v1/user/profile', auth, async (req, res) => {
    try {
        // req.user is attached by the 'auth' middleware
        const userResult = await pool.query('SELECT id, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }
        res.status(200).json({
            message: 'Profile data retrieved successfully.',
            user_profile: user
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

/**
 * @route POST /api/v1/auth/forgot-password
 * @desc Request a password reset OTP
 * @access Public
 */
app.post('/api/v1/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }
    try {
        const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            // Send 200 OK even if user not found to prevent email enumeration
            return res.status(200).json({ message: 'A password reset code has been sent to your email.' });
        }

        const otp = generateOtp();
        const otpExpiry = new Date(Date.now() + 10 * 60000); // 10 minutes from now

        await pool.query(
            'UPDATE users SET otp_code = $1, otp_expiry = $2 WHERE email = $3',
            [otp, otpExpiry, email]
        );

        // --- MOCK EMAIL SENDING ---
        console.log(`--- MOCK EMAIL SENDER ---`);
        console.log(`TO: ${email}`);
        console.log(`SUBJECT: ServiceHub Password Reset Code`);
        console.log(`OTP CODE: ${otp}`);
        console.log(`-------------------------`);
        // In a real app, use SendGrid/Mailgun API here to send the email.

        res.status(200).json({ message: 'A password reset code has been sent to your email.' });

    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'An error occurred during OTP request.' });
    }
});

/**
 * @route POST /api/v1/auth/reset-password
 * @desc Reset password using OTP
 * @access Public
 */
app.post('/api/v1/auth/reset-password', async (req, res) => {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) {
        return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
    }
    try {
        const userResult = await pool.query(
            'SELECT id, otp_code, otp_expiry FROM users WHERE email = $1', 
            [email]
        );
        const user = userResult.rows[0];

        if (!user || user.otp_code !== otp || new Date(user.otp_expiry) < new Date()) {
            return res.status(401).json({ error: 'Invalid or expired OTP.' });
        }

        // Hash the new password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(new_password, saltRounds);

        // Update password and clear OTP fields
        await pool.query(
            'UPDATE users SET password_hash = $1, otp_code = NULL, otp_expiry = NULL WHERE id = $2',
            [passwordHash, user.id]
        );

        res.status(200).json({ message: 'Password reset successfully. You can now log in.' });

    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'An error occurred during password reset.' });
    }
});


// --- PROVIDER ROUTES ---

/**
 * @route GET /api/v1/provider/profile
 * @desc Get provider profile details
 * @access Private (Provider only)
 */
app.get('/api/v1/provider/profile', auth, async (req, res) => {
    const { id: user_id, role } = req.user;
    if (role !== 'provider') {
        return res.status(403).json({ error: 'Access denied. Only providers can view profiles.' });
    }
    
    try {
        // Fetch provider profile and associated service IDs
        const profileQuery = `
            SELECT p.*, ARRAY_AGG(ps.service_id) AS service_ids
            FROM providers p
            LEFT JOIN provider_services ps ON p.id = ps.provider_id
            WHERE p.user_id = $1
            GROUP BY p.id;
        `;
        const result = await pool.query(profileQuery, [user_id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Provider profile not found. Complete setup first.' });
        }
        
        // Convert the aggregate array of service IDs (which might be null/empty) to a clean array
        const profile = result.rows[0];
        // Ensure service_ids is an array, even if empty
        profile.service_ids = Array.isArray(profile.service_ids) ? profile.service_ids.filter(id => id !== null) : [];

        res.status(200).json({ 
            message: 'Provider profile retrieved successfully.', 
            provider_profile: profile
        });

    } catch (err) {
        console.error('Provider profile fetch error:', err);
        res.status(500).json({ error: 'An error occurred during profile fetch.' });
    }
});

/**
 * @route POST /api/v1/provider/profile
 * @desc Create or update provider profile details
 * @access Private (Provider only)
 */
app.post('/api/v1/provider/profile', auth, async (req, res) => {
    const { id: user_id, role } = req.user;
    if (role !== 'provider') {
        return res.status(403).json({ error: 'Access denied. Only providers can update profiles.' });
    }

    const { display_name, bio, location_lat, location_lon, service_radius_km, service_ids } = req.body;

    if (!display_name || !bio || !service_ids || !Array.isArray(service_ids) || service_ids.length === 0) {
        return res.status(400).json({ error: 'Display name, bio, and at least one service ID are required.' });
    }

    try {
        await pool.query('BEGIN');

        // 1. Update the provider's main profile record
        const updateQuery = `
            UPDATE providers
            SET display_name = $1, bio = $2, location_lat = $3, location_lon = $4, 
                service_radius_km = $5, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $6
            RETURNING id;
        `;
        // CORRECTED ORDER: $1=display_name, $2=bio, $3=location_lat, $4=location_lon, $5=service_radius_km, $6=user_id
        const result = await pool.query(updateQuery, [
            display_name, 
            bio, 
            location_lat, 
            location_lon, 
            service_radius_km, 
            user_id
        ]);

        if (result.rows.length === 0) {
             // Handle case where provider row might not exist (shouldn't happen after registration)
             throw new Error('Provider record not found for this user_id.');
        }

        const provider_id = result.rows[0].id;

        // 2. Clear old service associations
        await pool.query('DELETE FROM provider_services WHERE provider_id = $1', [provider_id]);

        // 3. Insert new service associations
        const serviceInserts = service_ids.map(service_id => 
            pool.query('INSERT INTO provider_services (provider_id, service_id) VALUES ($1, $2)', [provider_id, service_id])
        );
        await Promise.all(serviceInserts);

        await pool.query('COMMIT');

        res.status(200).json({ 
            message: 'Provider profile updated successfully.', 
            provider_id: provider_id 
        });

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Provider profile update error (Details):', err); 
        res.status(500).json({ error: 'An error occurred during profile update.' });
    }
});


/**
 * @route GET /api/v1/provider/bookings
 * @desc Get all bookings associated with the logged-in provider
 * @access Private (Provider only)
 */
app.get('/api/v1/provider/bookings', auth, async (req, res) => {
    const { id: provider_user_id, role } = req.user;
    if (role !== 'provider') {
        return res.status(403).json({ error: 'Access denied. Only providers can view their bookings.' });
    }

    try {
        // 1. Find the provider's ID
        const providerResult = await pool.query('SELECT id FROM providers WHERE user_id = $1', [provider_user_id]);
        if (providerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Provider profile not found.' });
        }
        const provider_id = providerResult.rows[0].id;

        // 2. Fetch all bookings for that provider
        const bookingsQuery = `
            SELECT 
                b.id, b.scheduled_at, b.address, b.customer_notes, b.booking_status, 
                u.email AS customer_email, s.name AS service_name, b.customer_id
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            JOIN users u ON b.customer_id = u.id
            WHERE b.provider_id = $1
            ORDER BY b.scheduled_at DESC;
        `;
        const result = await pool.query(bookingsQuery, [provider_id]);

        res.status(200).json({
            message: `${result.rows.length} bookings retrieved.`,
            bookings: result.rows
        });
        
    } catch (err) {
        console.error('Provider bookings fetch error:', err);
        res.status(500).json({ error: 'An error occurred while fetching provider bookings.' });
    }
});


// --- BOOKING & MESSAGING ROUTES ---

/**
 * @route POST /api/v1/bookings
 * @desc Customer creates a new booking request
 * @access Private (Customer only)
 */
app.post('/api/v1/bookings', auth, async (req, res) => {
    const { id: customer_user_id, role } = req.user;
    if (role !== 'customer') {
        return res.status(403).json({ msg: 'Access denied. Only customers can create bookings.' });
    }
    
    const { provider_id, service_id, scheduled_at, address, customer_notes } = req.body;
    
    if (!provider_id || !service_id || !scheduled_at || !address) {
        return res.status(400).json({ error: 'Provider ID, Service ID, scheduled time, and address are required.' });
    }
    
    try {
        const bookingInsert = await pool.query(
            `INSERT INTO bookings (customer_id, provider_id, service_id, scheduled_at, address, customer_notes, booking_status) 
             VALUES ($1, $2, $3, $4, $5, $6, 'pending_provider') RETURNING id`,
            [customer_user_id, provider_id, service_id, scheduled_at, address, customer_notes]
        );

        const booking_id = bookingInsert.rows[0].id;

        // In a real app, notify the provider (email/push) here

        res.status(201).json({ 
            message: 'Booking request sent successfully to provider.', 
            booking_id: booking_id 
        });
        
    } catch (err) {
        console.error('Booking creation error:', err);
        res.status(500).json({ error: 'An error occurred during booking creation.' });
    }
});

/**
 * @route PUT /api/v1/bookings/:id
 * @desc Update booking status (Accept/Reject/Complete)
 * @access Private (Provider only)
 */
app.put('/api/v1/bookings/:id', auth, async (req, res) => {
    const { id: provider_user_id, role } = req.user;
    const booking_id = req.params.id;
    const { status } = req.body;

    if (role !== 'provider') {
        return res.status(403).json({ msg: 'Access denied. Only providers can update booking status.' });
    }
    if (!['accepted', 'rejected', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status update provided. Must be one of: accepted, rejected, completed.' });
    }

    try {
        // 1. Get Provider ID associated with the logged-in user
        const providerResult = await pool.query('SELECT id FROM providers WHERE user_id = $1', [provider_user_id]);
        
        if (providerResult.rows.length === 0) {
             return res.status(404).json({ error: 'Provider profile not found for this logged-in user.' });
        }
        
        const provider_id = providerResult.rows[0].id;
        
        // 2. Update the booking status, ensuring the provider owns the booking
        const updateQuery = `
            UPDATE bookings
            SET booking_status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND provider_id = $3
            RETURNING customer_id, booking_status;
        `;
        const result = await pool.query(updateQuery, [status, booking_id, provider_id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Booking not found or not owned by this provider.' });
        }
        
        const customer_user_id = result.rows[0].customer_id;
        
        // In a real app, notify the customer here

        res.status(200).json({
            message: `Booking #${booking_id} status updated to ${status}.`,
            new_status: status
        });

    } catch (err) {
        console.error('Booking update error:', err);
        res.status(500).json({ error: 'An error occurred while updating the booking status.' });
    }
});

/**
 * @route POST /api/v1/bookings/:id/messages
 * @desc Send a message within a booking chat
 * @access Private (Customer or Provider)
 */
app.post('/api/v1/bookings/:id/messages', auth, async (req, res) => {
    const sender_id = req.user.id;
    const booking_id = req.params.id;
    const { content } = req.body;

    if (!content) {
        return res.status(400).json({ error: 'Message content is required.' });
    }

    try {
        // 1. Verify the user is part of the booking and get recipient ID
        // Note: This query checks if the sender is the customer OR the user_id linked to the provider_id
        const bookingResult = await pool.query(
            'SELECT customer_id, provider_id FROM bookings WHERE id = $1 AND (customer_id = $2 OR (SELECT user_id FROM providers WHERE id = provider_id) = $2)',
            [booking_id, sender_id]
        );

        if (bookingResult.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied. You are not a party to this booking.' });
        }

        const booking = bookingResult.rows[0];
        
        // Determine the recipient ID (the other party in the booking)
        let recipient_id;
        if (sender_id === booking.customer_id) {
            // Sender is customer, recipient is provider's user_id
            recipient_id = await pool.query('SELECT user_id FROM providers WHERE id = $1', [booking.provider_id]).then(r => r.rows[0]?.user_id);
        } else {
            // Sender is provider, recipient is customer_id
            recipient_id = booking.customer_id;
        }

        if (!recipient_id) {
            return res.status(404).json({ error: 'Recipient user ID could not be determined.' });
        }
        
        // 2. Insert the message
        const messageInsert = await pool.query(
            'INSERT INTO messages (booking_id, sender_id, recipient_id, content) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
            [booking_id, sender_id, recipient_id, content]
        );

        // In a real app, trigger a Socket.IO or push notification here

        res.status(201).json({ 
            message: 'Message sent successfully.', 
            message_id: messageInsert.rows[0].id,
            created_at: messageInsert.rows[0].created_at
        });

    } catch (err) {
        console.error('Message send error:', err);
        res.status(500).json({ error: 'An error occurred while sending the message.' });
    }
});


// --- PAYMENT & REVIEW ROUTES ---

/**
 * @route POST /api/v1/payments
 * @desc Capture payment for a completed booking
 * @access Private (Customer only)
 */
app.post('/api/v1/payments', auth, async (req, res) => {
    const { id: customer_user_id, role } = req.user;
    const { booking_id, amount, payment_token } = req.body;

    if (role !== 'customer') {
        return res.status(403).json({ msg: 'Access denied. Only customers can make payments.' });
    }
    if (!booking_id || !amount || !payment_token) {
        return res.status(400).json({ error: 'Booking ID, amount, and payment token are required.' });
    }

    // Amount validation check (ensure amount is a positive number)
    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Verify booking status and customer ownership
        const bookingResult = await client.query(
            'SELECT customer_id, booking_status, provider_id FROM bookings WHERE id = $1',
            [booking_id]
        );
        const booking = bookingResult.rows[0];

        if (!booking) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Booking not found.' });
        }
        if (booking.customer_id !== customer_user_id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Access denied. You do not own this booking.' });
        }
        if (booking.booking_status !== 'completed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Cannot process payment. Booking status is '${booking.booking_status}'.` });
        }

        // --- MOCK PAYMENT GATEWAY CHARGE ---
        const transactionId = `txn_${Date.now()}${Math.random().toString(36).substring(2, 8)}`; 
        const paymentStatus = 'succeeded'; // Assume success for MVP
        // --- END MOCK ---
        
        // 2. Insert payment record
        await client.query(
            `INSERT INTO payments (booking_id, amount, status, gateway_transaction_id, paid_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [booking_id, amount, paymentStatus, transactionId]
        );

        // 3. Update booking status to closed
        await client.query(
            `UPDATE bookings SET booking_status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [booking_id]
        );

        await client.query('COMMIT');
        
        // In a real app, notify customer/provider of successful payment

        res.status(200).json({
            message: 'Payment captured successfully.',
            status: paymentStatus,
            transaction_id: transactionId
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('FATAL PAYMENT PROCESSING ERROR (PostgreSQL details):', err);
        res.status(500).json({ error: 'An error occurred during payment processing.' });
    } finally {
        client.release();
    }
});

/**
 * @route POST /api/v1/reviews
 * @desc Submit a review and rating for a paid booking
 * @access Private (Customer only)
 */
app.post('/api/v1/reviews', auth, async (req, res) => {
    const { id: customer_user_id, role } = req.user;
    const { booking_id, rating, comment } = req.body;

    if (role !== 'customer') {
        return res.status(403).json({ msg: 'Access denied. Only customers can submit reviews.' });
    }
    if (!booking_id || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Booking ID and a valid rating (1-5) are required.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Verify booking is paid and not already reviewed
        const bookingResult = await client.query(
            'SELECT b.customer_id, b.provider_id, b.booking_status, p.id AS payment_id, r.id AS review_id FROM bookings b LEFT JOIN payments p ON b.id = p.booking_id LEFT JOIN reviews r ON b.id = r.booking_id WHERE b.id = $1',
            [booking_id]
        );
        const booking = bookingResult.rows[0];

        if (!booking || booking.customer_id !== customer_user_id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Access denied. Booking not found or not owned by you.' });
        }
        if (booking.booking_status !== 'closed' || !booking.payment_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Cannot review unpaid or incomplete bookings.' });
        }
        if (booking.review_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'This booking has already been reviewed.' });
        }

        // 2. Insert the new review
        await client.query(
            `INSERT INTO reviews (booking_id, customer_id, provider_id, rating, comment)
             VALUES ($1, $2, $3, $4, $5)`,
            [booking_id, customer_user_id, booking.provider_id, rating, comment]
        );

        // 3. Update the provider's aggregate rating 
        const aggregateResult = await client.query(
            `SELECT CAST(AVG(rating) AS DECIMAL(3, 2)) AS avg_rating, COUNT(id) AS review_count 
             FROM reviews WHERE provider_id = $1`,
            [booking.provider_id]
        );
        const { avg_rating, review_count } = aggregateResult.rows[0];

        await client.query(
            `UPDATE providers 
             SET average_rating = $1, review_count = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $3`,
            [avg_rating, review_count, booking.provider_id]
        );

        await client.query('COMMIT');
        
        res.status(201).json({ message: 'Review submitted successfully. Provider rating updated.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Review submission error:', err);
        res.status(500).json({ error: 'An error occurred during review submission.' });
    } finally {
        client.release();
    }
});


// --- ADMIN ROUTES ---

/**
 * @route GET /api/v1/admin/users
 * @desc Get list of all users
 * @access Private (Admin only)
 */
app.get('/api/v1/admin/users', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }
    try {
        const result = await pool.query('SELECT id, email, role, created_at FROM users ORDER BY id DESC');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Admin user fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch user list.' });
    }
});

/**
 * @route GET /api/v1/admin/providers
 * @desc Get list of all providers with verification status
 * @access Private (Admin only)
 */
app.get('/api/v1/admin/providers', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }
    try {
        // Query to fetch all providers, joining user info and aggregating services offered
        const pgQuery = `
            SELECT 
                p.id AS id, 
                p.display_name, 
                p.is_verified, 
                p.average_rating, 
                p.review_count,
                u.email,
                STRING_AGG(s.name, ', ') AS services_offered
            FROM providers p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN provider_services ps ON p.id = ps.provider_id
            LEFT JOIN services s ON ps.service_id = s.id
            GROUP BY p.id, u.email
            ORDER BY p.id DESC;
        `;
        const result = await pool.query(pgQuery);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Admin provider fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch provider list.' });
    }
});

/**
 * @route GET /api/v1/admin/bookings
 * @desc Get list of all bookings 
 * @access Private (Admin only)
 */
app.get('/api/v1/admin/bookings', auth, async (req, res) => {
    // 1. Check if the user has the 'admin' role
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }
    
    try {
        // 2. Query the database to get all bookings with necessary joins
        const query = `
            SELECT 
                b.id, 
                p.display_name AS provider_name, 
                u.email AS customer_email,
                b.scheduled_at, 
                b.booking_status,
                b.created_at
            FROM bookings b
            JOIN providers p ON b.provider_id = p.id
            JOIN users u ON b.customer_id = u.id
            ORDER BY b.created_at DESC;
        `;
        const result = await pool.query(query);

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Admin bookings fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch booking list.' });
    }
});

/**
 * @route PUT /api/v1/admin/providers/:id/verify
 * @desc Toggle provider verification status
 * @access Private (Admin only)
 */
app.put('/api/v1/admin/providers/:id/verify', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }
    const provider_id = req.params.id;
    const { is_verified } = req.body;

    if (typeof is_verified !== 'boolean') {
        return res.status(400).json({ error: 'Verification status must be a boolean.' });
    }

    try {
        const result = await pool.query(
            'UPDATE providers SET is_verified = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING user_id',
            [is_verified, provider_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Provider not found.' });
        }

        res.status(200).json({ message: `Provider ${provider_id} verification status set to ${is_verified}.` });
    } catch (err) {
        console.error('Admin verification error:', err);
        res.status(500).json({ error: 'Failed to update verification status.' });
    }
});

// --- SERVER START ---
// Retrieve PORT from environment variables, defaulting to 3001
const PORT = process.env.PORT || 3001; 

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`); 
});
