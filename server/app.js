const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer'); 
const path = require('path'); 
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

// --- STATIC FILES / FILE UPLOAD CONFIGURATION ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Use user ID and a timestamp to ensure unique names
        const ext = path.extname(file.originalname);
        // Ensure req.user.id exists before using it, fallback to 'public' if not authed yet
        const userId = req.user?.id || 'public'; 
        cb(null, `${userId}-${Date.now()}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        // Check mime type for security
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(null, false);
            return cb(new Error('Only images and PDF files are allowed!'));
        }
    }
});

// Serve files from the 'uploads' directory statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// ------------------------------------------------------------------------

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
 * @desc Sends an email using Nodemailer. Re-throws error for route handling.
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
        // Do not re-throw error in this version to prevent app from crashing on failed email notification
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
 * @desc List and filter providers by service ID and customer location/radius. Also supports top_rated sorting.
 * @access Public
 */
app.get('/api/v1/providers', async (req, res) => {
    const { service_id, lat, lon, sort_by } = req.query;
    
    // Allow fetching without specific location for top_rated on homepage, but recommend location for actual search
    if (!service_id && sort_by !== 'top_rated') {
         return res.status(400).json({ error: 'Service ID or sort_by=top_rated is required.' });
    }

    const customerLat = parseFloat(lat || 0);
    const customerLon = parseFloat(lon || 0);
    
    // Check if lat/lon were explicitly provided or are non-zero (indicating a specific search intent)
    const isLocationProvided = !!lat && !!lon && (customerLat !== 0 || customerLon !== 0); 
    
    try {
        let query = `
            SELECT 
                p.id, p.display_name, p.is_verified, p.average_rating, p.review_count,
                p.location_lat, p.location_lon, p.service_radius_km,
                u.profile_picture_url, 
                s.name AS service_name,
                s.id AS service_id
            FROM providers p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN provider_services ps ON p.id = ps.provider_id
            LEFT JOIN services s ON s.id = ps.service_id
            WHERE p.is_verified = TRUE
        `;
        const queryParams = [];

        if (service_id) {
            query += ` AND ps.service_id = $1`;
            queryParams.push(service_id);
        }

        query += ` GROUP BY p.id, u.profile_picture_url, s.name, s.id`;


        // FIX: Ensure top-rated query is correct for database sorting
        if (sort_by === 'top_rated') {
            query += ` ORDER BY p.average_rating DESC, p.review_count DESC LIMIT 10`;
        } else {
             query += ` ORDER BY p.average_rating DESC`; // Default sort for standard search
        }

        const result = await pool.query(query, queryParams);

        const filteredProviders = result.rows.map(provider => {
            const providerLat = parseFloat(provider.location_lat || 0);
            const providerLon = parseFloat(provider.location_lon || 0);
            
            // Only calculate distance if a location is provided
            const distance = isLocationProvided ? calculateDistance(
                customerLat, 
                customerLon, 
                providerLat, 
                providerLon
            ) : null; 
            
            return {
                ...provider,
                distance_km: distance !== null ? Math.round(distance * 10) / 10 : null
            };
        }).filter(provider => {
            // FILTER LOGIC:
            // 1. If fetching top rated, include all.
            if (sort_by === 'top_rated') return true; 
            
            // 2. If a location was NOT provided, include all (no distance filter).
            if (!isLocationProvided) return true; 

            // 3. If a location WAS provided, apply the radius filter.
            return provider.distance_km !== null && provider.distance_km <= provider.service_radius_km;

        }).sort((a, b) => {
            // FINAL SORT: Prioritize distance if location is provided for standard search
            if (isLocationProvided && sort_by !== 'top_rated') {
                 return a.distance_km - b.distance_km;
            }
            // For top rated, DB sort is usually enough, but here we enforce rating sort again
            if (sort_by === 'top_rated') {
                 return b.average_rating - a.average_rating;
            }
            return 0; 
        });

        // Limit top-rated results to 5 for homepage display if requested
        const finalProviders = sort_by === 'top_rated' ? filteredProviders.slice(0, 5) : filteredProviders;

        res.status(200).json({
            message: `${finalProviders.length} providers found.`,
            providers: finalProviders
        });

    } catch (err) {
        console.error('Provider search error:', err);
        res.status(500).json({ error: 'An error occurred during provider search.' });
    }
});


/**
 * @route POST /api/v1/contact-us
 * @desc Submit a contact form message to be viewed by Admin
 * @access Public
 */
app.post('/api/v1/contact-us', async (req, res) => {
    const { name, email, problem_description } = req.body;

    if (!name || !email || !problem_description) {
        return res.status(400).json({ error: 'Name, email, and a description are required.' });
    }
    
    try {
        // Assumes a 'contact_messages' table exists for admin view
        const result = await pool.query(
            'INSERT INTO contact_messages (sender_name, sender_email, message) VALUES ($1, $2, $3) RETURNING id',
            [name, email, problem_description]
        );

        // Notify admin via email (optional)
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
        await sendEmail(
            adminEmail,
            `New Contact Form Submission (ID: ${result.rows[0].id})`,
            `<h2>New Contact Message Received</h2><p>From: ${name} (${email})</p><p>Message: ${problem_description}</p>`
        );

        res.status(201).json({ message: 'Message submitted successfully. Admin will review shortly.' });

    } catch (err) {
        console.error('Contact form submission error:', err);
        res.status(500).json({ error: 'An error occurred during submission.' });
    }
});


// --- AUTHENTICATION ROUTES ---

/**
 * @route POST /api/v1/auth/register
 * @desc Create a new user (customer or provider) and send OTP
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
        const userExists = await pool.query('SELECT id, status FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0 && userExists.rows[0].status === 'active') {
            return res.status(409).json({ error: 'Email already exists and is active.' });
        }
        
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const otp = generateOtp();
        const otpExpiry = new Date(Date.now() + 10 * 60000); // 10 minutes from now
        const status = 'pending_verification';

        // Use UPSERT logic to create or update a user stuck in pending verification
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, role, status, otp_code, otp_expiry) 
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (email) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                role = EXCLUDED.role,
                status = $4,
                otp_code = $5,
                otp_expiry = $6
             RETURNING id, role`,
            [email, passwordHash, role, status, otp, otpExpiry]
        );
        
        // --- REAL EMAIL SENDING: Registration OTP ---
        const emailBody = `
            <h2>Service Connect Email Verification</h2>
            <p>Thank you for registering. Please use the following code to verify your account:</p>
            <p>Your one-time password (OTP) is: <strong>${otp}</strong></p>
            <p>This code is valid for 10 minutes.</p>
        `;
        await sendEmail(
            email,
            'Service Connect: Verify Your Account',
            emailBody
        );

        res.status(201).json({ 
            message: 'Registration initiation successful. OTP sent to your email for verification.', 
            user_id: result.rows[0].id,
            role: role
        });
    } catch (err) {
        console.error('Registration initiation error:', err);
        res.status(500).json({ error: 'An error occurred during registration initiation.' });
    }
});

/**
 * @route POST /api/v1/auth/verify-otp
 * @desc Verify OTP and activate the user account
 * @access Public
 */
app.post('/api/v1/auth/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required.' });
    }
    
    try {
        const userResult = await pool.query(
            'SELECT id, role, otp_code, otp_expiry, status FROM users WHERE email = $1', 
            [email]
        );
        const user = userResult.rows[0];

        if (!user || user.status !== 'pending_verification') {
            return res.status(400).json({ error: 'Account not found or already verified.' });
        }
        
        if (user.otp_code !== otp || new Date(user.otp_expiry) < new Date()) {
            // Check if OTP is matched first, if so, invalid/expired
            if (user.otp_code === otp) {
                return res.status(401).json({ error: 'OTP has expired. Please try registering again.' });
            }
            return res.status(401).json({ error: 'Invalid OTP code.' });
        }

        // OTP is valid and not expired, activate the account
        await pool.query(
            'UPDATE users SET status = $1, otp_code = NULL, otp_expiry = NULL WHERE id = $2',
            ['active', user.id]
        );

        const user_id = user.id;

        // Perform initial profile setup for customer/provider
        if (user.role === 'provider') {
            await pool.query(
                'INSERT INTO providers (user_id, display_name, bio, location_lat, location_lon, service_radius_km) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (user_id) DO NOTHING',
                [user_id, `New Provider ${user_id}`, 'A dedicated service provider.', 0, 0, 10]
            );
        } else if (user.role === 'customer') {
            await pool.query(
                'INSERT INTO customer_profiles (user_id, full_name, phone_number, location_lat, location_lon) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id) DO NOTHING',
                [user_id, '', null, 0, 0]
            );
        }
        
        // Ensure every new user has a wallet record
        await pool.query(
            'INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', 
            [user_id]
        );

        res.status(200).json({ message: 'Account verified successfully.', role: user.role });

    } catch (err) {
        console.error('OTP verification error:', err);
        res.status(500).json({ error: 'An error occurred during verification.' });
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
        const userResult = await pool.query('SELECT id, password_hash, role, status FROM users WHERE email = $1', [email]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
        
        if (user.status !== 'active') {
             return res.status(401).json({ error: 'Account is not active. Please check your email for verification code.' });
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
        // FIX: Corrected column name to profile_picture_url
        const userResult = await pool.query('SELECT id, email, role, created_at, profile_picture_url FROM users WHERE id = $1', [user_id]);
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
                INSERT INTO customer_profiles (user_id, full_name, phone_number, address_line_1, city, location_lat, location_lon)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
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
 * @route POST /api/v1/user/profile-photo
 * @desc Uploads and updates authenticated user's profile picture.
 * @access Private
 */
app.post('/api/v1/user/profile-photo', auth, (req, res, next) => {
    // Single file upload middleware, field name is 'profile_photo'
    // NOTE: The client sends the file under the name 'profile_photo'
    upload.single('profile_photo')(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading.
            return res.status(400).json({ error: err.message });
        } else if (err) {
            // An unknown error occurred.
            return res.status(500).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const user_id = req.user.id;
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        
        try {
            // FIX: Corrected column name to profile_picture_url
            await pool.query(
                'UPDATE users SET profile_picture_url = $1 WHERE id = $2',
                [fileUrl, user_id]
            );

            res.status(200).json({
                message: 'Profile picture uploaded successfully.',
                profile_picture_url: fileUrl // Sending the correct key back
            });
        } catch (dbError) {
            console.error('DB update error on profile photo:', dbError);
            res.status(500).json({ error: 'Failed to save photo URL to database.' });
        }
    });
});


/**
 * @route GET /api/v1/user/wallet
 * @desc Get authenticated user's wallet balance
 * @access Private
 */
app.get('/api/v1/user/wallet', auth, async (req, res) => {
    const user_id = req.user.id;
    
    try {
        const walletQuery = await pool.query(
            'SELECT balance FROM wallets WHERE user_id = $1', 
            [user_id]
        );
        
        if (walletQuery.rows.length === 0) {
            // This should not happen if the registration flow is correct, but handle it gracefully
            await pool.query('INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [user_id]);
            return res.status(200).json({ balance: 0.00 });
        }

        // NEW: Also fetch pending requests count
        const pendingRequests = await pool.query(
            'SELECT COUNT(id) FROM wallet_requests WHERE user_id = $1 AND status = $2',
            [user_id, 'pending']
        );


        res.status(200).json({
            message: 'Wallet balance retrieved successfully.',
            balance: parseFloat(walletQuery.rows[0].balance),
            pending_requests_count: parseInt(pendingRequests.rows[0].count, 10)
        });
    } catch (err) {
        console.error('Wallet fetch error:', err);
        res.status(500).send('Server Error retrieving wallet.');
    }
});


// --- NEW WALLET REQUEST ROUTES ---

/**
 * @route POST /api/v1/customer/wallet/deposit-request
 * @desc Customer submits a deposit request after paying via QR/UPI.
 * @access Private (Customer only)
 */
app.post('/api/v1/customer/wallet/deposit-request', auth, upload.single('screenshot_file'), async (req, res) => {
    const { id: user_id, role } = req.user;
    const { amount: amountStr, transaction_reference } = req.body;
    const file = req.file;

    if (role !== 'customer') {
        return res.status(403).json({ error: 'Access denied. Only customers can request deposits.' });
    }
    
    const amount = parseFloat(amountStr);
    
    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Invalid deposit amount.' });
    }
    if (!transaction_reference) {
         return res.status(400).json({ error: 'UPI Transaction Reference is required.' });
    }
    if (!file) {
        return res.status(400).json({ error: 'Screenshot proof is required.' });
    }
    
    const screenshotUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;


    try {
        const result = await pool.query(
            'INSERT INTO wallet_requests (user_id, type, amount, transaction_reference, screenshot_url) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [user_id, 'deposit', amount, transaction_reference, screenshotUrl]
        );
        
        // Notify admin via email (optional in mock, but good practice)
        console.log(`NEW DEPOSIT REQUEST: User ${user_id} for ${amount}. Request ID: ${result.rows[0].id}`);

        res.status(201).json({ 
            message: 'Deposit request submitted for admin approval.', 
            request_id: result.rows[0].id 
        });

    } catch (err) {
        console.error('Deposit request error:', err);
        res.status(500).json({ error: 'An error occurred during deposit request.' });
    }
});

/**
 * @route POST /api/v1/provider/wallet/withdraw-request
 * @desc Provider submits a withdrawal request.
 * @access Private (Provider only)
 */
app.post('/api/v1/provider/wallet/withdraw-request', auth, async (req, res) => {
    const { id: user_id, role } = req.user;
    const { amount, transaction_reference } = req.body; // transaction_reference holds UPI ID or Bank details

    if (role !== 'provider') {
        return res.status(403).json({ error: 'Access denied. Only providers can request withdrawals.' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Invalid withdrawal amount.' });
    }
    if (!transaction_reference) {
         return res.status(400).json({ error: 'UPI ID or Bank Details are required for withdrawal.' });
    }
    
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        // 1. Check if balance is sufficient (FOR UPDATE to lock row)
        const walletResult = await client.query('SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE', [user_id]);
        const currentBalance = parseFloat(walletResult.rows[0]?.balance || 0);

        if (amount > currentBalance) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient wallet balance for withdrawal request.' });
        }
        
        // 2. Insert withdrawal request
        const result = await pool.query(
            'INSERT INTO wallet_requests (user_id, type, amount, transaction_reference) VALUES ($1, $2, $3, $4) RETURNING id',
            [user_id, 'withdrawal', amount, transaction_reference]
        );
        
        await client.query('COMMIT');
        
        // Notify admin via email (optional in mock, but good practice)
        console.log(`NEW WITHDRAWAL REQUEST: User ${user_id} for ${amount}. Request ID: ${result.rows[0].id}`);

        res.status(201).json({ 
            message: 'Withdrawal request submitted for admin approval.',
            request_id: result.rows[0].id 
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Withdrawal request error:', err);
        res.status(500).json({ error: 'An error occurred during withdrawal request.' });
    } finally {
        client.release();
    }
});

// --- END NEW WALLET REQUEST ROUTES ---


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
        const userResult = await pool.query('SELECT id FROM users WHERE email = $1 AND status = $2', [email, 'active']);
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
            'SELECT id, otp_code, otp_expiry FROM users WHERE email = $1 AND status = $2', 
            [email, 'active']
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
 * @route GET /api/v1/provider/earnings
 * @desc Get provider earnings and performance analytics
 * @access Private (Provider only)
 */
app.get('/api/v1/provider/earnings', auth, async (req, res) => {
    const { id: user_id, role } = req.user;
    if (role !== 'provider') {
        return res.status(403).json({ error: 'Access denied. Only providers can view earnings.' });
    }

    try {
        const analyticsQuery = `
            SELECT 
                w.balance AS wallet_balance,
                p.average_rating,
                p.review_count,
                COUNT(b.id) FILTER (WHERE b.booking_status = 'closed' AND b.amount IS NOT NULL) AS completed_jobs,
                -- FIX: Total earnings sum should track all money CREDITED from payments
                COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'payment_received' OR t.type = 'deposit_admin_approved'), 0) AS total_money_credited
            FROM users u
            JOIN providers p ON u.id = p.user_id
            LEFT JOIN wallets w ON w.user_id = u.id
            LEFT JOIN bookings b ON b.provider_id = p.id
            LEFT JOIN transactions t ON t.user_id = u.id 
            WHERE u.id = $1
            GROUP BY w.balance, p.average_rating, p.review_count;
        `;
        
        const result = await pool.query(analyticsQuery, [user_id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Provider analytics not found.' });
        }
        
        const row = result.rows[0];
        
        res.status(200).json({
            message: 'Provider analytics retrieved successfully.',
            analytics: {
                wallet_balance: parseFloat(row.wallet_balance || 0),
                average_rating: parseFloat(row.average_rating || 0),
                review_count: parseInt(row.review_count || 0, 10),
                completed_jobs: parseInt(row.completed_jobs || 0, 10),
                // FIX: Use total_money_credited as total_earnings
                total_earnings: parseFloat(row.total_money_credited || 0),
            }
        });

    } catch (err) {
        console.error('Provider earnings fetch error:', err);
        res.status(500).json({ error: 'An error occurred during earnings fetch.' });
    }
});

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
        // FIX: Corrected column name to profile_picture_url
        const profileQuery = `
            SELECT p.*, ARRAY_AGG(ps.service_id) AS service_ids, u.profile_picture_url
            FROM providers p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN provider_services ps ON p.id = ps.provider_id
            WHERE p.user_id = $1
            GROUP BY p.id, u.profile_picture_url;
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

    const { display_name, bio, location_lat, location_lon, service_radius_km, service_ids, payout_upi_id } = req.body;

    if (!display_name || !bio || !service_ids || !Array.isArray(service_ids) || service_ids.length === 0) {
        return res.status(400).json({ error: 'Display name, bio, and at least one service ID are required.' });
    }

    // Payout UPI ID is only validated/updated if present in the request body (allows separate form updates)
    if (!payout_upi_id && req.body.hasOwnProperty('payout_upi_id')) {
        return res.status(400).json({ error: 'Payout UPI ID is required.' });
    }

    try {
        await pool.query('BEGIN');
        
        let updateFields = 'display_name = $1, bio = $2, location_lat = $3, location_lon = $4, service_radius_km = $5, updated_at = CURRENT_TIMESTAMP';
        let updateParams = [display_name, bio, location_lat, location_lon, service_radius_km];
        
        if (payout_upi_id !== undefined) {
             updateFields += `, payout_upi_id = $${updateParams.length + 1}`;
             updateParams.push(payout_upi_id);
        }
        updateParams.push(user_id); // User ID is the last parameter

        const updateQuery = `
            UPDATE providers
            SET ${updateFields}
            WHERE user_id = $${updateParams.length}
            RETURNING id;
        `;
        const result = await pool.query(updateQuery, updateParams);

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
                b.id, b.scheduled_at, b.address, b.customer_notes, b.booking_status, b.amount, b.service_description,
                u.email AS customer_email, u.profile_picture_url AS customer_photo, s.name AS service_name, b.customer_id
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
                b.id, b.scheduled_at, b.address, b.customer_notes, b.booking_status, b.amount, b.service_description,
                p.display_name AS provider_name, s.name AS service_name, b.provider_id, u.profile_picture_url AS provider_photo
            FROM bookings b
            JOIN providers p ON b.provider_id = p.id
            JOIN services s ON b.service_id = s.id
            JOIN users u ON p.user_id = u.id
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
        
        // Insert booking (status is pending_provider)
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
            <p>Please log into your Provider Dashboard to review and <strong>Set Price</strong> or <strong>Reject</strong> this request.</p>
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
 * @desc Update booking status (Reject/Complete) AND handle Provider Price Setting (Accept)
 * @access Private (Provider only)
 */
app.put('/api/v1/bookings/:id', auth, async (req, res) => {
    const { id: provider_user_id, role } = req.user;
    const booking_id = req.params.id;
    const { status, amount } = req.body; // amount is optional, used only for 'accepted' status

    if (role !== 'provider') {
        return res.status(403).json({ msg: 'Access denied. Only providers can update booking status.' });
    }
    
    // FIX: Updated validStatuses to contain client-side triggers (rejected, completed, closed, accepted)
    const validStatuses = ['accepted', 'rejected', 'completed', 'closed']; 
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status update provided.' });
    }

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const providerResult = await client.query('SELECT id FROM providers WHERE user_id = $1', [provider_user_id]);
        
        if (providerResult.rows.length === 0) {
             await client.query('ROLLBACK');
             return res.status(404).json({ error: 'Provider profile not found for this logged-in user.' });
        }
        
        const provider_id = providerResult.rows[0].id;
        let customer_user_id;
        let updateQuery;
        let queryParams;
        let nextStatus = status;


        if (status === 'accepted') {
            // Logic: Provider sets the price, moves status to AWAITING CUSTOMER CONFIRMATION
            if (typeof amount !== 'number' || amount <= 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Amount is required and must be positive when accepting a service.' });
            }
            
            nextStatus = 'awaiting_customer_confirmation';
            updateQuery = `
                UPDATE bookings
                SET booking_status = $3, amount = $4, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND provider_id = $2
                RETURNING customer_id, booking_status, amount;
            `;
            queryParams = [booking_id, provider_id, nextStatus, amount];
            
        } else if (status === 'rejected' || status === 'completed' || status === 'closed') {
            // Simple status update
            updateQuery = `
                UPDATE bookings
                SET booking_status = $3, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND provider_id = $2
                RETURNING customer_id, booking_status, amount;
            `;
            queryParams = [booking_id, provider_id, nextStatus];
        } else {
             // Should not happen due to validation, but ensures safety
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Invalid operation.' });
        }

        const result = await client.query(updateQuery, queryParams);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Booking not found or not owned by this provider.' });
        }
        
        customer_user_id = result.rows[0].customer_id;
        
        // Retrieve customer email for notification
        const customerEmailResult = await client.query('SELECT email FROM users WHERE id = $1', [customer_user_id]);
        const customerEmail = customerEmailResult.rows[0]?.email;
        
        // --- REAL EMAIL SENDING: Notification to Customer ---
        if (customerEmail) {
            let subject = `Service Connect Booking Update: ${nextStatus.toUpperCase()}`;
            let emailBody = `<p>Your booking (ID: ${booking_id}) status has been updated to <strong>${nextStatus}</strong>.</p>`;
            
            if (nextStatus === 'awaiting_customer_confirmation') {
                subject = `Service Connect: Price Quote Received for Booking ${booking_id}`;
                emailBody = `
                    <h2>Action Required: Price Quote Received!</h2>
                    <p>Your service request (ID: ${booking_id}) has been reviewed by the provider.</p>
                    <p>The quoted price is <strong>₹${parseFloat(amount).toFixed(2)}</strong>.</p>
                    <p>Please log into your Customer Dashboard to **Confirm** or **Reject** this price before proceeding.</p>
                `;
            } else if (nextStatus === 'completed') {
                subject = `Service Connect: Action Required - Payment Due for Booking ${booking_id}`;
                emailBody = `
                    <h2>Service Completed - Payment Due</h2>
                    <p>Your service for booking ID ${booking_id} has been marked as <strong>Completed</strong> by the provider.</p>
                    <p>Please log in to your dashboard to complete the payment.</p>
                `;
            } else if (nextStatus === 'rejected') {
                 emailBody = `
                    <h2>Service Request Rejected</h2>
                    <p>We are sorry, but your service request (ID: ${booking_id}) was **rejected** by the provider.</p>
                    <p>Please search for another service provider in your area.</p>
                `;
            }

            await sendEmail(customerEmail, subject, emailBody);
        }
        
        await client.query('COMMIT');

        res.status(200).json({
            message: `Booking #${booking_id} status updated to ${nextStatus}.`,
            new_status: nextStatus
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Booking update error:', err);
        res.status(500).json({ error: 'An error occurred while updating the booking status.' });
    } finally {
        client.release();
    }
});


/**
 * @route PUT /api/v1/bookings/:id/confirm-price
 * @desc Customer accepts or rejects the provider's quoted price.
 * @access Private (Customer only)
 */
app.put('/api/v1/bookings/:id/confirm-price', auth, async (req, res) => {
    const { id: customer_user_id, role } = req.user;
    const booking_id = req.params.id;
    const { accepted } = req.body; // boolean: true for accept, false for reject

    if (role !== 'customer') {
        return res.status(403).json({ error: 'Access denied. Only customers can confirm prices.' });
    }
    if (typeof accepted !== 'boolean') {
        return res.status(400).json({ error: 'Confirmation status (accepted) must be a boolean.' });
    }

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        let newStatus;
        let subject;
        let message;

        if (accepted) {
            newStatus = 'accepted';
            subject = `Booking ${booking_id} Price ACCEPTED!`;
            message = 'Price confirmed! The service is now officially accepted.';
        } else {
            newStatus = 'rejected';
            subject = `Booking ${booking_id} Price REJECTED (Booking Cancelled)`;
            message = 'Price rejected. The booking has been cancelled.';
        }

        const updateQuery = `
            UPDATE bookings
            SET booking_status = $3, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND customer_id = $2 AND booking_status = 'awaiting_customer_confirmation'
            RETURNING provider_id, amount;
        `;
        const result = await client.query(updateQuery, [booking_id, customer_user_id, newStatus]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Booking not found, not owned by you, or status is incorrect.' });
        }
        
        const provider_id = result.rows[0].provider_id;
        
        // Retrieve provider email for notification
        const providerEmailResult = await client.query('SELECT u.email FROM providers p JOIN users u ON p.user_id = u.id WHERE p.id = $1', [provider_id]);
        const providerEmail = providerEmailResult.rows[0]?.email;
        
        // Notify provider
        if (providerEmail) {
            const emailBody = `
                <h2>Booking ${booking_id} Update: ${newStatus.toUpperCase()}</h2>
                <p>The customer has **${newStatus.toUpperCase()}** the quoted price of ₹${parseFloat(result.rows[0].amount).toFixed(2)}.</p>
                ${accepted ? '<p>The booking is now ACCEPTED. You may start communication via chat.</p>' : '<p>The booking has been cancelled and moved to rejected status.</p>'}
            `;
            await sendEmail(providerEmail, subject, emailBody);
        }
        
        await client.query('COMMIT');

        res.status(200).json({
            message: message,
            new_status: newStatus
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Price confirmation error:', err);
        res.status(500).json({ error: 'An error occurred during price confirmation.' });
    } finally {
        client.release();
    }
});


/**
 * @route GET /api/v1/user/unread-messages
 * @desc Retrieve count of unread messages for the logged-in user
 * @access Private
 */
app.get('/api/v1/user/unread-messages', auth, async (req, res) => {
    const user_id = req.user.id;

    try {
        const countQuery = `
            SELECT COUNT(m.id) AS unread_count
            FROM messages m
            WHERE m.recipient_id = $1 AND m.is_read = FALSE;
        `;
        const result = await pool.query(countQuery, [user_id]);

        res.status(200).json({
            unread_count: parseInt(result.rows[0].unread_count, 10)
        });

    } catch (err) {
        console.error('Unread count fetch error:', err.message);
        res.status(500).json({ error: 'Failed to fetch unread count.' });
    }
});

/**
 * @route PUT /api/v1/messages/read
 * @desc Mark all messages for a specific booking chat as read
 * @access Private
 */
app.put('/api/v1/messages/read', auth, async (req, res) => {
    const { id: user_id } = req.user;
    const { booking_id } = req.body;

    if (!booking_id) {
        return res.status(400).json({ error: 'Booking ID is required.' });
    }

    try {
        // Only mark as read messages where the logged-in user is the recipient
        const updateQuery = `
            UPDATE messages
            SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
            WHERE booking_id = $1 AND recipient_id = $2 AND is_read = FALSE;
        `;
        await pool.query(updateQuery, [booking_id, user_id]);

        res.status(200).json({ message: 'Messages marked as read.' });

    } catch (err) {
        console.error('Mark read error:', err.message);
        res.status(500).json({ error: 'Failed to mark messages as read.' });
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
            SELECT m.id, m.sender_id, m.content, m.created_at, m.file_url, u.email AS sender_email
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
 * @desc Send a text message within a booking chat
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
        
        // Determine recipient ID
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
            // is_read defaults to FALSE
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


/**
 * @route POST /api/v1/bookings/:id/messages/upload
 * @desc Send a file attachment within a booking chat
 * @access Private (Customer or Provider)
 */
app.post('/api/v1/bookings/:id/messages/upload', auth, upload.single('file'), async (req, res) => {
    const sender_id = req.user.id;
    const booking_id = req.params.id;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: 'File attachment is required.' });
    }
    
    // FIX: Use actual server path for file access
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    const content = `File uploaded: ${file.originalname}`;

    try {
        const bookingResult = await pool.query(
            'SELECT customer_id, provider_id FROM bookings WHERE id = $1 AND (customer_id = $2 OR (SELECT user_id FROM providers WHERE id = provider_id) = $2)',
            [booking_id, sender_id]
        );

        if (bookingResult.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied. You are not a party to this booking.' });
        }

        const booking = bookingResult.rows[0];
        
        // Determine recipient ID
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
            // is_read defaults to FALSE
            'INSERT INTO messages (booking_id, sender_id, recipient_id, content, file_url) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at',
            [booking_id, sender_id, recipient_id, content, fileUrl]
        );

        res.status(201).json({ 
            message: 'File sent successfully.', 
            message_id: messageInsert.rows[0].id,
            created_at: messageInsert.rows[0].created_at,
            file_url: fileUrl
        });

    } catch (err) {
        console.error('File send error:', err);
        res.status(500).json({ error: 'An error occurred while sending the file.' });
    }
});


// --- PAYMENT & REVIEW ROUTES ---

/**
 * @route POST /api/v1/payments
 * @desc Capture payment for a completed booking using customer wallet balance.
 * @access Private (Customer only)
 */
app.post('/api/v1/payments', auth, async (req, res) => {
    const { id: customer_user_id, role } = req.user;
    const { booking_id } = req.body;

    if (role !== 'customer') {
        return res.status(403).json({ msg: 'Access denied. Only customers can make payments.' });
    }
    if (!booking_id) {
        return res.status(400).json({ error: 'Booking ID is required.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Fetch booking details, ensuring it's the customer's and completed
        const bookingResult = await client.query(
            'SELECT customer_id, booking_status, provider_id, amount FROM bookings WHERE id = $1 FOR UPDATE',
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
        
        const paymentAmount = parseFloat(booking.amount);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Payment amount is invalid or zero.' });
        }
        
        // 2. Check customer wallet balance
        const customerWallet = await client.query('SELECT balance, user_id FROM wallets WHERE user_id = $1 FOR UPDATE', [customer_user_id]);
        const customerBalance = parseFloat(customerWallet.rows[0]?.balance || 0);
        
        if (customerBalance < paymentAmount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Insufficient wallet balance. Required: ₹${paymentAmount.toFixed(2)}` });
        }

        // 3. Process Transaction: Debit Customer
        await client.query(
            'UPDATE wallets SET balance = balance - $1 WHERE user_id = $2',
            [paymentAmount, customer_user_id]
        );
        await client.query(
            `INSERT INTO transactions (user_id, type, amount, related_id)
             VALUES ($1, $2, $3, $4)`,
            [customer_user_id, 'payment_sent', paymentAmount, booking_id]
        );
        
        // 4. Process Transaction: Credit Provider
        const providerUserResult = await client.query('SELECT user_id FROM providers WHERE id = $1', [booking.provider_id]);
        const provider_user_id = providerUserResult.rows[0]?.user_id;

        if (!provider_user_id) {
            // Should not happen, but safe rollback if provider user ID is missing
            await client.query('ROLLBACK');
            return res.status(500).json({ error: 'Provider account user ID not found.' });
        }
        
        await client.query(
            'UPDATE wallets SET balance = balance + $1 WHERE user_id = $2',
            [paymentAmount, provider_user_id]
        );
        await client.query(
            `INSERT INTO transactions (user_id, type, amount, related_id)
             VALUES ($1, $2, $3, $4)`,
            [provider_user_id, 'payment_received', paymentAmount, booking_id]
        );

        // 5. Log Payment and Update Booking Status to closed
        const transactionId = `txn_${Date.now()}${Math.random().toString(36).substring(2, 8)}`; 
        await client.query(
            `INSERT INTO payments (booking_id, amount, status, gateway_transaction_id, paid_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [booking_id, paymentAmount, 'succeeded', transactionId]
        );
        await client.query(
            `UPDATE bookings SET booking_status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [booking_id]
        );

        await client.query('COMMIT');
        
        res.status(200).json({
            message: 'Payment captured successfully. Your provider has been credited.',
            status: 'succeeded',
            transaction_id: transactionId
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('FATAL PAYMENT PROCESSING ERROR (PostgreSQL details):', err);
        res.status(500).json({ error: 'An error occurred during payment processing. Transaction rolled back.' });
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
    // Rating is optional (can be 0) but must be a valid number
    if (!booking_id || typeof rating !== 'number' || rating < 0 || rating > 5) {
        return res.status(400).json({ error: 'Booking ID and a valid rating (0-5) are required for submission.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Validate booking and payment status
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

        // 2. Insert Review (only if rating > 0 or comment exists, or just insert always if optional)
        await client.query(
            `INSERT INTO reviews (booking_id, customer_id, provider_id, rating, comment)
             VALUES ($1, $2, $3, $4, $5)`,
            [booking_id, customer_user_id, booking.provider_id, rating, comment]
        );

        // 3. Recalculate Provider Rating (only include reviews with rating > 0)
        const aggregateResult = await client.query(
            `SELECT CAST(AVG(rating) FILTER (WHERE rating > 0) AS DECIMAL(3, 2)) AS avg_rating, COUNT(id) FILTER (WHERE rating > 0) AS review_count 
             FROM reviews WHERE provider_id = $1`,
            [booking.provider_id]
        );
        const { avg_rating, review_count } = aggregateResult.rows[0];

        await client.query(
            `UPDATE providers 
             SET average_rating = $1, review_count = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $3`,
            [avg_rating || 0, review_count || 0, booking.provider_id]
        );
        
        // 4. Send email notification to provider
        const providerEmailResult = await client.query('SELECT u.email FROM providers p JOIN users u ON p.user_id = u.id WHERE p.id = $1', [booking.provider_id]);
        const providerEmail = providerEmailResult.rows[0]?.email;
        
        if (providerEmail) {
            const emailBody = `
                <h2>New Review Received!</h2>
                <p>A customer left a review for booking ID ${booking_id}.</p>
                ${rating > 0 ? `<p>Rating: <strong>${rating} out of 5 stars</strong></p>` : ''}
                ${comment ? `<p>Comment: <em>${comment}</em></p>` : ''}
                <p>Your new average rating is ${avg_rating || 'N/A'}.</p>
            `;
            await sendEmail(providerEmail, `New Customer Review for Booking ${booking_id}`, emailBody);
        }


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
 * @route GET /api/v1/admin/overview-metrics
 * @desc Get key counts for Admin Overview, including pending wallet requests
 * @access Private (Admin only)
 */
app.get('/api/v1/admin/overview-metrics', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }
    
    try {
        const totalUsers = await pool.query('SELECT COUNT(id) FROM users');
        const totalBookings = await pool.query('SELECT COUNT(id) FROM bookings');
        const pendingVerification = await pool.query('SELECT COUNT(id) FROM providers WHERE is_verified = FALSE');
        
        // FIX: Fetch counts of pending wallet requests (Deposit and Withdrawal)
        const pendingDeposits = await pool.query("SELECT COUNT(id) FROM wallet_requests WHERE status = 'pending' AND type = 'deposit'");
        const pendingWithdrawals = await pool.query("SELECT COUNT(id) FROM wallet_requests WHERE status = 'pending' AND type = 'withdrawal'");

        res.status(200).json({
            total_users: parseInt(totalUsers.rows[0].count, 10),
            total_bookings: parseInt(totalBookings.rows[0].count, 10),
            pending_verification: parseInt(pendingVerification.rows[0].count, 10),
            pending_deposits: parseInt(pendingDeposits.rows[0].count, 10),
            pending_withdrawals: parseInt(pendingWithdrawals.rows[0].count, 10),
        });
    } catch (err) {
        console.error('Admin overview metric fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch overview metrics.' });
    }
});


/**
 * @route GET /api/v1/admin/contact-messages
 * @desc Get all contact form messages
 * @access Private (Admin only)
 */
app.get('/api/v1/admin/contact-messages', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }
    
    try {
        // Assumes contact_messages table exists
        const query = 'SELECT * FROM contact_messages ORDER BY created_at DESC';
        const result = await pool.query(query);

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Admin contact message fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch contact messages.' });
    }
});


/**
 * @route GET /api/v1/admin/wallet-requests
 * @desc Get all pending wallet requests (deposit/withdrawal)
 * @access Private (Admin only)
 */
app.get('/api/v1/admin/wallet-requests', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }
    
    try {
        const query = `
            SELECT 
                wr.id, 
                wr.user_id,
                wr.type, 
                wr.amount, 
                wr.transaction_reference, 
                wr.screenshot_url,
                wr.requested_at, 
                u.email, 
                u.role,
                wr.status
            FROM wallet_requests wr
            JOIN users u ON wr.user_id = u.id
            ORDER BY wr.status, wr.requested_at ASC;
        `;
        const result = await pool.query(query);

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Admin wallet request fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch wallet requests.' });
    }
});

/**
 * @route PUT /api/v1/admin/wallet-requests/:id/approve
 * @desc Admin approves a wallet request and updates balances/transactions.
 * @access Private (Admin only)
 */
app.put('/api/v1/admin/wallet-requests/:id/approve', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }
    const request_id = req.params.id;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Fetch and lock the request
        const requestResult = await client.query(
            'SELECT id, user_id, type, amount, status FROM wallet_requests WHERE id = $1 AND status = $2 FOR UPDATE',
            [request_id, 'pending']
        );
        const request = requestResult.rows[0];

        if (!request) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Pending request not found.' });
        }

        const { user_id, type, amount } = request;
        const adjustment = type === 'deposit' ? amount : -amount;
        const txnType = type === 'deposit' ? 'deposit_admin_approved' : 'withdrawal_sent';

        // 2. Update wallet balance
        const walletUpdate = await client.query(
            'UPDATE wallets SET balance = balance + $1 WHERE user_id = $2 RETURNING balance',
            [adjustment, user_id]
        );
        
        // Safety check for withdrawal to prevent negative balance if balance changed externally
        if (type === 'withdrawal' && walletUpdate.rows[0].balance < 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Withdrawal failed: Insufficient funds or concurrent modification.' });
        }


        // 3. Log transaction
        await client.query(
            'INSERT INTO transactions (user_id, type, amount) VALUES ($1, $2, $3)',
            [user_id, txnType, amount]
        );

        // 4. Update request status
        await client.query(
            'UPDATE wallet_requests SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['approved', request_id]
        );

        await client.query('COMMIT');
        
        res.status(200).json({
            message: `${type.toUpperCase()} request #${request_id} approved. Balance updated.`,
            new_balance: parseFloat(walletUpdate.rows[0].balance)
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Admin request approval error:', err);
        res.status(500).json({ error: 'An error occurred during approval process.' });
    } finally {
        client.release();
    }
});

/**
 * @route PUT /api/v1/admin/wallet-requests/:id/reject
 * @desc Admin rejects a wallet request.
 * @access Private (Admin only)
 */
app.put('/api/v1/admin/wallet-requests/:id/reject', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }
    const request_id = req.params.id;
    const { reason } = req.body;

    try {
        const result = await pool.query(
            'UPDATE wallet_requests SET status = $1, processed_at = CURRENT_TIMESTAMP, transaction_reference = $3 WHERE id = $2 AND status = $4 RETURNING id',
            ['rejected', request_id, reason || 'Rejected by Admin.', 'pending']
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Pending request not found or already processed.' });
        }

        res.status(200).json({ message: `Request #${request_id} rejected successfully.` });
    } catch (err) {
        console.error('Admin request rejection error:', err);
        res.status(500).json({ error: 'An error occurred during rejection.' });
    }
});


app.get('/api/v1/admin/users', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }
    try {
        // FIX: Corrected column name to profile_picture_url
        const result = await pool.query('SELECT id, email, role, status, created_at, profile_picture_url FROM users ORDER BY id DESC');
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
                u.profile_picture_url,
                STRING_AGG(s.name, ', ') AS services_offered
            FROM providers p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN provider_services ps ON p.id = ps.provider_id
            LEFT JOIN services s ON ps.service_id = s.id
            GROUP BY p.id, u.email, u.profile_picture_url
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
