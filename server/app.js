const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
// NEW: Import Nodemailer
const nodemailer = require('nodemailer'); 
require('dotenv').config();

// NOTE: Assumes 'middleware/auth.js' exists and handles JWT verification and attaches req.user
const auth = require('./middleware/auth'); 

const app = express();

// --- CRITICAL FIX: CORS MIDDLEWARE ---
app.use(cors({
    origin: 'http://localhost:3000'
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
        console.error('Database connection failed:', err);
    } else {
        console.log('Database connected successfully!');
    }
});

// --- NODEMAILER CONFIGURATION ---
const transporter = nodemailer.createTransport({
    service: 'gmail', // Use 'gmail' for Google, or configure another SMTP host
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// --- HELPER FUNCTIONS ---

/**
 * @function sendEmail
 * @desc Sends an email using Nodemailer. Replaces the mock console.log function.
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
    }
};

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
    res.send('Welcome to the Service Connect Backend API!');
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
 * @desc List and filter providers by service ID and customer location/radius
 * @access Public
 */
app.get('/api/v1/providers', async (req, res) => {
    const { service_id, lat, lon } = req.query;

    if (!service_id || !lat || !lon) {
        return res.status(400).json({ error: 'Service ID, latitude, and longitude are required for search.' });
    }

    try {
        const query = `
            SELECT p.* FROM providers p
            JOIN provider_services ps ON p.id = ps.provider_id
            WHERE ps.service_id = $1 AND p.is_verified = TRUE;
        `;
        const result = await pool.query(query, [service_id]);

        const customerLat = parseFloat(lat);
        const customerLon = parseFloat(lon);

        const filteredProviders = result.rows.map(provider => {
            const providerLat = parseFloat(provider.location_lat || 0);
            const providerLon = parseFloat(provider.location_lon || 0);

            const distance = calculateDistance(
                customerLat, 
                customerLon, 
                providerLat, 
                providerLon
            );
            return {
                ...provider,
                distance_km: Math.round(distance * 10) / 10
            };
        }).filter(provider => 
            provider.distance_km <= provider.service_radius_km
        ).sort((a, b) => a.distance_km - b.distance_km);

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
 * @desc Create a new user (customer or provider) - Admin role hidden from registration
 * @access Public
 */
app.post('/api/v1/auth/register', async (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ error: 'Email, password, and role are required.' });
    }
    if (!['customer', 'provider'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role specified. Must be customer or provider.' });
    }

    try {
        const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(409).json({ error: 'Email already exists.' });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        await pool.query('BEGIN');

        const userInsert = await pool.query(
            'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
            [email, passwordHash, role]
        );
        const user_id = userInsert.rows[0].id;

        if (role === 'provider') {
            await pool.query(
                'INSERT INTO providers (user_id, display_name, bio, location_lat, location_lon, service_radius_km) VALUES ($1, $2, $3, $4, $5, $6)',
                [user_id, `New Provider ${user_id}`, 'A dedicated service provider.', 0, 0, 10]
            );
        } else if (role === 'customer') {
            await pool.query(
                'INSERT INTO customer_profiles (user_id, full_name, phone_number, location_lat, location_lon) VALUES ($1, $2, $3, $4, $5)',
                [user_id, 'New Customer', null, 0, 0]
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
 * @desc Authenticate and log in a user (Includes Admin Backdoor)
 * @access Public
 */
app.post('/api/v1/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        const userResult = await pool.query('SELECT id, password_hash, role FROM users WHERE email = $1', [email]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // 3. ADMIN BACKDOOR CHECK
        let effectiveRole = user.role;
        if (process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL) {
            effectiveRole = 'admin';
            console.log(`ALERT: User ${user.email} authenticated as Admin.`);
        }
        
        // 4. Generate a JWT token
        const payload = {
            user: {
                id: user.id,
                role: effectiveRole
            }
        };
        
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ 
            message: 'Login successful.', 
            token,
            user_id: user.id,
            role: effectiveRole
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
    const user_id = req.user.id;
    const role = req.user.role;
    
    try {
        const userResult = await pool.query('SELECT id, email, role, created_at FROM users WHERE id = $1', [user_id]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }
        
        if (role === 'customer') {
            const profileQuery = `
                SELECT 
                    cp.full_name, cp.phone_number, cp.address_line_1, cp.city, cp.location_lat, cp.location_lon
                FROM customer_profiles cp
                WHERE cp.user_id = $1
            `;
            const profileResult = await pool.query(profileQuery, [user_id]);
            user.profile = profileResult.rows[0] || {}; 
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
 * @route PUT /api/v1/user/profile
 * @desc Update authenticated user profile data (email and customer profile details)
 * @access Private
 */
app.put('/api/v1/user/profile', auth, async (req, res) => {
    const { email, full_name, phone_number, address_line_1, city, location_lat, location_lon } = req.body;
    const user_id = req.user.id;
    const role = req.user.role;

    if (!email) {
        return res.status(400).json({ error: 'Email is required for update.' });
    }
    
    const lat = location_lat ? parseFloat(location_lat) : null;
    const lon = location_lon ? parseFloat(location_lon) : null;


    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. Check if the new email already exists for another user
        const emailCheck = await client.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, user_id]);
        if (emailCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Email already in use by another account.' });
        }
        
        // 2. Update the user email
        await client.query(
            'UPDATE users SET email = $1 WHERE id = $2',
            [email, user_id]
        );
        
        // 3. Update customer profile if the user is a customer
        if (role === 'customer') {
            const updateCustomerQuery = `
                INSERT INTO customer_profiles (user_id, full_name, phone_number, address_line_1, city, location_lat, location_lon, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id) 
                DO UPDATE SET 
                    full_name = COALESCE($2, customer_profiles.full_name),
                    phone_number = COALESCE($3, customer_profiles.phone_number),
                    address_line_1 = COALESCE($4, customer_profiles.address_line_1),
                    city = COALESCE($5, customer_profiles.city),
                    location_lat = COALESCE($6, customer_profiles.location_lat),
                    location_lon = COALESCE($7, customer_profiles.location_lon),
                    updated_at = CURRENT_TIMESTAMP
                WHERE customer_profiles.user_id = $1;
            `;
            await client.query(updateCustomerQuery, [
                user_id, 
                full_name, 
                phone_number, 
                address_line_1, 
                city, 
                lat, 
                lon
            ]);
        }
        
        await client.query('COMMIT');
        
        res.status(200).json({
            message: 'Profile updated successfully.',
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('User profile update error:', err);
        res.status(500).json({ error: 'An error occurred during profile update.' });
    } finally {
        client.release();
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

        // --- REAL EMAIL SENDING: Forgot Password ---
        const emailBody = `
            <h2>Service Connect Password Reset</h2>
            <p>You requested a password reset for your Service Connect account.</p>
            <p>Your one-time password (OTP) is: <strong>${otp}</strong></p>
            <p>This code is valid for 10 minutes. Please use it immediately to set a new password.</p>
            <p>If you did not request this, please ignore this email.</p>
        `;
        await sendEmail(
            email,
            'Service Connect: Password Reset Code',
            emailBody
        );

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

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(new_password, saltRounds);

        await pool.query(
            'UPDATE users SET password_hash = $1, otp_code = NULL, otp_expiry = NULL WHERE id = $2',
            [passwordHash, user.id]
        );
        
        // --- REAL EMAIL SENDING: Password Success Notification ---
        const emailBody = `
            <h2>Service Connect Password Reset Successful</h2>
            <p>Your password for your Service Connect account was successfully reset.</p>
            <p>If you did not authorize this change, please contact support immediately.</p>
        `;
        await sendEmail(
            email,
            'Service Connect: Password Reset Confirmation',
            emailBody
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
        
        const profile = result.rows[0];
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

        const updateQuery = `
            UPDATE providers
            SET display_name = $1, bio = $2, location_lat = $3, location_lon = $4, 
                service_radius_km = $5, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $6
            RETURNING id;
        `;
        const result = await pool.query(updateQuery, [
            display_name, 
            bio, 
            location_lat, 
            location_lon, 
            service_radius_km, 
            user_id
        ]);

        if (result.rows.length === 0) {
             throw new Error('Provider record not found for this user_id. Setup failed.');
        }

        const provider_id = result.rows[0].id;

        await pool.query('DELETE FROM provider_services WHERE provider_id = $1', [provider_id]);

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
        const providerResult = await pool.query('SELECT id FROM providers WHERE user_id = $1', [provider_user_id]);
        if (providerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Provider profile not found.' });
        }
        const provider_id = providerResult.rows[0].id;

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

/**
 * @route GET /api/v1/customer/bookings
 * @desc Get all bookings associated with the logged-in customer
 * @access Private (Customer only)
 */
app.get('/api/v1/customer/bookings', auth, async (req, res) => {
    const { id: customer_user_id, role } = req.user;
    if (role !== 'customer') {
        return res.status(403).json({ error: 'Access denied. Only customers can view their bookings.' });
    }

    try {
        const bookingsQuery = `
            SELECT 
                b.id, b.scheduled_at, b.address, b.customer_notes, b.booking_status, 
                p.display_name AS provider_name, s.name AS service_name, b.provider_id
            FROM bookings b
            JOIN providers p ON b.provider_id = p.id
            JOIN services s ON b.service_id = s.id
            WHERE b.customer_id = $1
            ORDER BY b.scheduled_at DESC;
        `;
        const result = await pool.query(bookingsQuery, [customer_user_id]);

        res.status(200).json({
            message: `${result.rows.length} bookings retrieved.`,
            bookings: result.rows
        });
        
    } catch (err) {
        console.error('Customer bookings fetch error:', err);
        res.status(500).json({ error: 'An error occurred while fetching customer bookings.' });
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
    
    const { provider_id, service_id, scheduled_at, address, customer_notes, service_description } = req.body;
    
    if (!provider_id || !service_id || !scheduled_at || !address || !service_description) {
        return res.status(400).json({ error: 'Provider ID, Service ID, scheduled time, address, and description are required.' });
    }
    
    try {
        // Retrieve provider email, display name, and service name for notification
        const providerInfoResult = await pool.query(
            'SELECT u.email, p.display_name, s.name AS service_name FROM providers p JOIN users u ON p.user_id = u.id JOIN services s ON s.id = $2 WHERE p.id = $1',
            [provider_id, service_id]
        );
        const providerInfo = providerInfoResult.rows[0];

        if (!providerInfo) {
            return res.status(404).json({ error: 'Provider or service information not found.' });
        }
        
        // Insert booking (service_description is stored in the table as per schema update)
        const bookingInsert = await pool.query(
            `INSERT INTO bookings (customer_id, provider_id, service_id, scheduled_at, address, customer_notes, service_description, booking_status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_provider') RETURNING id`,
            [customer_user_id, provider_id, service_id, scheduled_at, address, customer_notes, service_description]
        );

        const booking_id = bookingInsert.rows[0].id;
        
        // --- REAL EMAIL SENDING: New Booking Request to Provider ---
        const emailBody = `
            <h2>New Booking Request - ${providerInfo.service_name} (ID: ${booking_id})</h2>
            <p>Dear ${providerInfo.display_name},</p>
            <p>A new service request has been submitted for your service:</p>
            <ul>
                <li><strong>Service:</strong> ${providerInfo.service_name}</li>
                <li><strong>Scheduled Time:</strong> ${new Date(scheduled_at).toLocaleString()}</li>
                <li><strong>Location:</strong> ${address}</li>
            </ul>
            <p><strong>Customer's Detailed Description:</strong><br/>${service_description}</p>
            <p>Please log into your Provider Dashboard to review and <strong>Accept</strong> or <strong>Reject</strong> this request.</p>
        `;
        await sendEmail(
            providerInfo.email,
            `New Service Request (ID: ${booking_id}) on Service Connect`,
            emailBody
        );

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
    if (!['accepted', 'rejected', 'completed', 'closed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status update provided.' });
    }

    try {
        const providerResult = await pool.query('SELECT id FROM providers WHERE user_id = $1', [provider_user_id]);
        
        if (providerResult.rows.length === 0) {
             return res.status(404).json({ error: 'Provider profile not found for this logged-in user.' });
        }
        
        const provider_id = providerResult.rows[0].id;
        
        // Update the booking status, ensuring the provider owns the booking
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
        
        // Retrieve customer email for notification
        const customerEmailResult = await pool.query('SELECT email FROM users WHERE id = $1', [customer_user_id]);
        const customerEmail = customerEmailResult.rows[0]?.email;
        
        // --- REAL EMAIL SENDING: Notification to Customer ---
        if (customerEmail) {
            let subject = `Service Connect Booking Update: ${status.toUpperCase()}`;
            let emailBody = `<p>Your booking (ID: ${booking_id}) status has been updated to <strong>${status}</strong>.</p>`;
            
            if (status === 'accepted') {
                subject = `Service Connect: Your Request has been ACCEPTED!`;
                emailBody = `
                    <h2>Your Service Request has been Accepted!</h2>
                    <p>Great news! Your service request (ID: ${booking_id}) has been **accepted** by the provider.</p>
                    <p>You can now use the **in-app chat** feature in your dashboard to coordinate details directly with your service provider.</p>
                `;
            } else if (status === 'completed') {
                subject = `Service Connect: Action Required - Payment Due for Booking ${booking_id}`;
                emailBody = `
                    <h2>Service Completed - Payment Due</h2>
                    <p>Your service for booking ID ${booking_id} has been marked as <strong>Completed</strong> by the provider.</p>
                    <p>Please log in to your dashboard to make the final payment and optionally leave a review.</p>
                `;
            } else if (status === 'rejected') {
                 emailBody = `
                    <h2>Service Request Rejected</h2>
                    <p>We are sorry, but your service request (ID: ${booking_id}) was **rejected** by the provider.</p>
                    <p>Please search for another service provider in your area.</p>
                `;
            }

            await sendEmail(customerEmail, subject, emailBody);
        }

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
 * @route GET /api/v1/bookings/:id/messages
 * @desc Retrieve all messages for a specific booking chat
 * @access Private (Customer or Provider who is a party to the booking)
 */
app.get('/api/v1/bookings/:id/messages', auth, async (req, res) => {
    const user_id = req.user.id;
    const booking_id = req.params.id;

    try {
        const bookingResult = await pool.query(
            'SELECT customer_id, provider_id FROM bookings WHERE id = $1 AND (customer_id = $2 OR (SELECT user_id FROM providers WHERE id = provider_id) = $2)',
            [booking_id, user_id]
        );

        if (bookingResult.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied. You are not a party to this booking.' });
        }
        
        const messagesQuery = `
            SELECT m.id, m.sender_id, m.content, m.created_at, u.email AS sender_email
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.booking_id = $1
            ORDER BY m.created_at ASC;
        `;
        const messagesResult = await pool.query(messagesQuery, [booking_id]);

        res.status(200).json({ 
            message: `${messagesResult.rows.length} messages retrieved.`,
            messages: messagesResult.rows 
        });

    } catch (err) {
        console.error('Message fetch error:', err);
        res.status(500).json({ error: 'An error occurred while fetching messages.' });
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
        const bookingResult = await pool.query(
            'SELECT customer_id, provider_id FROM bookings WHERE id = $1 AND (customer_id = $2 OR (SELECT user_id FROM providers WHERE id = provider_id) = $2)',
            [booking_id, sender_id]
        );

        if (bookingResult.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied. You are not a party to this booking.' });
        }

        const booking = bookingResult.rows[0];
        
        let recipient_id;
        if (sender_id === booking.customer_id) {
            recipient_id = await pool.query('SELECT user_id FROM providers WHERE id = $1', [booking.provider_id]).then(r => r.rows[0]?.user_id);
        } else {
            recipient_id = booking.customer_id;
        }

        if (!recipient_id) {
            return res.status(404).json({ error: 'Recipient user ID could not be determined.' });
        }
        
        const messageInsert = await pool.query(
            'INSERT INTO messages (booking_id, sender_id, recipient_id, content) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
            [booking_id, sender_id, recipient_id, content]
        );

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

    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

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
            return res.status(400).json({ error: `Cannot process payment. Booking status is '${booking.booking_status}'. Provider must mark as completed first.` });
        }

        // --- MOCK PAYMENT GATEWAY CHARGE ---
        const transactionId = `txn_${Date.now()}${Math.random().toString(36).substring(2, 8)}`; 
        const paymentStatus = 'succeeded';
        // --- END MOCK ---
        
        await client.query(
            `INSERT INTO payments (booking_id, amount, status, gateway_transaction_id, paid_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [booking_id, amount, paymentStatus, transactionId]
        );

        // Update booking status to closed (paid)
        await client.query(
            `UPDATE bookings SET booking_status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [booking_id]
        );

        await client.query('COMMIT');
        
        res.status(200).json({
            message: 'Payment captured successfully. You can now leave an optional review.',
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
 * @desc Submit a review and rating for a paid booking (Optional for Customer)
 * @access Private (Customer only)
 */
app.post('/api/v1/reviews', auth, async (req, res) => {
    const { id: customer_user_id, role } = req.user;
    const { booking_id, rating, comment } = req.body;

    if (role !== 'customer') {
        return res.status(403).json({ msg: 'Access denied. Only customers can submit reviews.' });
    }
    if (!booking_id || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Booking ID and a valid rating (1-5) are required for submission.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

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

        await client.query(
            `INSERT INTO reviews (booking_id, customer_id, provider_id, rating, comment)
             VALUES ($1, $2, $3, $4, $5)`,
            [booking_id, customer_user_id, booking.provider_id, rating, comment]
        );

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

app.get('/api/v1/admin/providers', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }
    try {
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

app.get('/api/v1/admin/bookings', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }
    
    try {
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
const PORT = process.env.PORT || 3001; 

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`); 
    console.log(`Nodemailer is configured for: ${process.env.EMAIL_USER}`);
});
