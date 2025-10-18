import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

// --- API Configuration ---
const API_BASE_URL = 'http://localhost:3001/api/v1';
const CURRENCY_SYMBOL = '₹'; // Indian Rupees
// Mock UPI QR Code URL for deposit - Admin's Account
// NOTE: Ensure this local image file exists in your project directory
const MOCK_UPI_QR_CODE_URL = '/qr_code_admin.png'; 
// --- Global Styling Classes (Dark Cyan Theme) ---
const DARK_CYAN_CLASS = 'bg-[#008080]'; // Main background/button color
const DARK_CYAN_TEXT_CLASS = 'text-[#008080]'; // Main text/accent color
const DARK_CYAN_HOVER_CLASS = 'hover:bg-[#006666]'; // Darker hover state

// --- UTILITY FUNCTIONS ---
// Helper to safely read nested user profile data
const getProfileField = (user, field, defaultValue = '') => user?.profile?.[field] || defaultValue;

const getPhotoUrl = (user) => {
    // Uses the corrected database column name 'profile_picture_url'
    return user?.profile_picture_url || 'https://placehold.co/100x100/F0F4FF/4338CA?text=User';
};

// --- AUTH CONTEXT ---

const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0); 

    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
    }, []);

    const fetchUserProfile = useCallback(async (authToken) => {
        if (!authToken) {
            setUser(null);
            setLoading(false);
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/user/profile`, {
                headers: { 'x-auth-token': authToken },
            });
            const data = await response.json();
            
            if (response.ok) {
                setUser(data.user_profile);
            } else {
                logout(); 
            }
        } catch (error) {
            console.error("Failed to fetch user profile:", error);
            logout();
        } finally {
            setLoading(false);
        }
    }, [logout]);
    
    // New: Fetch unread message count (for the bell icon)
    const fetchUnreadCount = useCallback(async (authToken) => {
        if (!authToken || !user || user.role === 'admin') return;
        try {
            const response = await fetch(`${API_BASE_URL}/user/unread-messages`, {
                headers: { 'x-auth-token': authToken },
            });
            if (response.ok) {
                const data = await response.json();
                setUnreadCount(data.unread_count || 0);
            }
        } catch (error) {
            console.error("Failed to fetch unread count:", error);
        }
    }, [user]);

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        fetchUserProfile(storedToken);
    }, [fetchUserProfile]);
    
    // Polling for unread count
    useEffect(() => {
        if (!token || loading || user?.role === 'admin') return;
        
        // Fetch immediately, then set up poll
        fetchUnreadCount(token); 
        
        const interval = setInterval(() => {
            fetchUnreadCount(token);
        }, 15000); // Poll every 15 seconds

        return () => clearInterval(interval);
    }, [token, loading, fetchUnreadCount, user]);

    // New: Mark messages as read
    const markMessagesAsRead = useCallback(async (bookingId) => {
        if (!token) return;
        try {
             const response = await fetch(`${API_BASE_URL}/messages/read`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ booking_id: bookingId }),
            });
            if (response.ok) {
                fetchUnreadCount(token); // Refresh header count
            }
        } catch (error) {
            console.error('Failed to mark messages as read:', error);
        }
    }, [token, fetchUnreadCount]);


    const login = async (email, password) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.token);
                setToken(data.token);
                await fetchUserProfile(data.token);
                return { success: true, role: data.role };
            } else {
                return { success: false, message: data.error || 'Login failed' };
            }
        } catch (error) {
            return { success: false, message: 'Network error. Please try again.' };
        }
    };

    const register = async (email, password, role) => {
         try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role }),
            });
            const data = await response.json();
            if (response.ok) {
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.error || 'Registration failed' };
            }
        } catch (error) {
            return { success: false, message: 'Network error' };
        }
    };
    
    // New: OTP Verification during Registration
    const verifyOtp = async (email, otp) => {
         try {
            const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp }),
            });
            const data = await response.json();
            if (response.ok) {
                return { success: true, role: data.role };
            } else {
                return { success: false, message: data.error || 'Invalid OTP or account not found.' };
            }
        } catch (error) {
            return { success: false, message: 'Network error' };
        }
    };


    const sendOtp = async (email) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await response.json();
            if (response.ok) {
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.error || 'Failed to send OTP.' };
            }
        } catch (error) {
            return { success: false, message: 'Network error.' };
        }
    };

    const resetPassword = async (email, otp, newPassword) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp, new_password: newPassword }),
            });
            const data = await response.json();
            if (response.ok) {
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.error || 'Invalid code or password.' };
            }
        } catch (error) {
            return { success: false, message: 'Network error.' };
        }
    };

    const value = { 
        user, 
        token, 
        login, 
        logout, 
        register, 
        loading, 
        isAuthenticated: !!user, 
        fetchUserProfile, 
        sendOtp, 
        resetPassword,
        verifyOtp, 
        unreadCount, 
        markMessagesAsRead, 
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

const useAuth = () => useContext(AuthContext);

// --- HELPER & UI COMPONENTS ---

const Header = ({ setPage }) => {
    const { isAuthenticated, user, logout, unreadCount } = useAuth();
    
    const handleLogout = () => {
        logout();
        setPage('home');
    };
    
    const getDashboardPage = () => {
        if (!user) return 'login';
        switch (user.role) {
            case 'admin': return 'adminDashboard';
            case 'provider': return 'providerDashboard';
            case 'customer': return 'customerDashboard';
            default: return 'home';
        }
    };

    return (
        <header className={`${DARK_CYAN_CLASS} text-white shadow-lg sticky top-0 z-50`}>
            <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
                {/* Home Text Link */}
                <div onClick={() => setPage('home')} className="cursor-pointer text-2xl font-extrabold flex items-center group hover:text-cyan-200 transition">
                    Service Connect
                </div>
                <div className="hidden md:flex items-center space-x-8">
                    <a onClick={() => setPage('home')} className="hover:text-cyan-200 font-medium cursor-pointer transition duration-150">Home</a>
                    <a onClick={() => setPage('allServices')} className="hover:text-cyan-200 font-medium cursor-pointer transition duration-150">Services</a>
                    <a onClick={() => setPage('about')} className="hover:text-cyan-200 font-medium cursor-pointer transition duration-150">About</a>
                    <a onClick={() => setPage('contact')} className="hover:text-cyan-200 font-medium cursor-pointer transition duration-150">Contact</a>
                </div>
                <div className="flex items-center space-x-4">
                    {isAuthenticated ? (
                        <>
                            {/* FIX: Notification Bell (Only for Customer/Provider) */}
                            {user.role !== 'admin' && (
                                <button 
                                    onClick={() => setPage(getDashboardPage())} 
                                    title={unreadCount > 0 ? `You have ${unreadCount} unread messages` : "No new notifications"}
                                    className="relative text-3xl p-1 rounded-full hover:bg-[#006666] transition"
                                >
                                    🔔
                                    {unreadCount > 0 && (
                                        <span className="absolute top-[-8px] right-[-8px] bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-white">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </button>
                            )}

                            {/* Profile Photo in Header */}
                            <img 
                                src={getPhotoUrl(user)} 
                                alt="Profile" 
                                className="w-8 h-8 rounded-full object-cover border-2 border-white cursor-pointer" 
                                onClick={() => setPage(getDashboardPage())}
                            />
                            <button onClick={() => setPage(getDashboardPage())} className="text-white font-semibold hover:text-cyan-200 transition relative hidden sm:block">
                                Dashboard
                            </button>
                            <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-md hover:bg-red-600 transition">
                                Logout
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setPage('login')} className={`bg-white ${DARK_CYAN_TEXT_CLASS} px-4 py-2 rounded-lg shadow-md hover:bg-gray-100 transition font-bold`}>
                            Login / Sign up
                        </button>
                    )}
                </div>
            </nav>
        </header>
    );
};


const Footer = ({ setPage }) => (
    <footer className="bg-slate-900 text-white mt-16">
        <div className="container mx-auto px-6 py-10">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 border-b border-gray-700 pb-8">
                {/* Section 1: Company Info/Customers Say */}
                <div>
                    <h4 className="font-semibold mb-4 text-gray-200">What Our Customers Say</h4>
                    <ul className="space-y-2 text-sm">
                        <li><a className="text-gray-400 hover:text-cyan-400 cursor-pointer transition">Testimonials</a></li>
                        <li><a className="text-gray-400 hover:text-cyan-400 cursor-pointer transition">Reviews</a></li>
                    </ul>
                </div>
                {/* Section 2: Company */}
                <div>
                    <h4 className="font-semibold mb-4 text-gray-200">Company</h4>
                    <ul className="space-y-2 text-sm">
                        <li><a onClick={() => setPage('about')} className="text-gray-400 hover:text-cyan-400 cursor-pointer transition">About Us</a></li>
                        <li><a onClick={() => setPage('contact')} className="text-gray-400 hover:text-cyan-400 cursor-pointer transition">Contact Us</a></li>
                        <li><a className="text-gray-400 hover:text-cyan-400 cursor-pointer transition">Careers</a></li>
                    </ul>
                </div>
                 {/* Section 3: Services */}
                <div>
                    <h4 className="font-semibold mb-4 text-gray-200">Services</h4>
                    <ul className="space-y-2 text-sm">
                        <li><a onClick={() => setPage('allServices')} className="text-gray-400 hover:text-cyan-400 cursor-pointer transition">All Services</a></li>
                        <li><a className="text-gray-400 hover:text-cyan-400 cursor-pointer transition">Terms & Privacy</a></li>
                    </ul>
                </div>
                {/* Section 4: Connect With Us */}
                <div className="col-span-2 md:col-span-2">
                    <h4 className="font-semibold mb-4 text-gray-200">Connect With Us</h4>
                    <div className="flex space-x-4 text-2xl">
                        {/* Placeholder Social Icons */}
                        <a className="text-gray-400 hover:text-cyan-400 transition">f</a>
                        <a className="text-gray-400 hover:text-cyan-400 transition">t</a>
                        <a className="text-gray-400 hover:text-cyan-400 transition">in</a>
                    </div>
                </div>
            </div>
            <div className="mt-6 text-center text-gray-500 text-sm">
                &copy; {new Date().getFullYear()} Service Connect. All rights reserved.
            </div>
        </div>
    </footer>
);


const ServiceCard = ({ service, onClick }) => (
    <div
        onClick={() => onClick(service)}
        className="bg-white p-4 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col items-center text-center border border-gray-200 group"
    >
        <div className="text-3xl mb-2 p-2 bg-blue-50 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">{service.icon || '⚡'}</div>
        <h3 className="text-md font-bold text-slate-800 mb-1 group-hover:text-blue-600">{service.name}</h3>
        <p className="text-gray-500 text-xs line-clamp-1">{service.description || 'Professional Service'}</p>
    </div>
);


const ProviderCard = ({ provider, onClick }) => (
    <div onClick={() => onClick(provider)} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer flex flex-col p-4 space-y-3 border border-gray-200 min-w-[280px]">
        
        <div className="flex items-center space-x-3">
            <img className="w-16 h-16 rounded-full object-cover shadow-md" 
                src={provider.profile_picture_url || `https://placehold.co/150x150/E0E7FF/4338CA?text=${provider.display_name.charAt(0)}`} 
                alt={provider.display_name} 
            />
            <div className="flex-grow">
                <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-bold text-slate-800">{provider.display_name}</h3>
                    {provider.is_verified && <span title="Verified Professional" className="bg-green-100 text-green-800 text-xs font-semibold px-1 py-0.5 rounded-full border border-green-300">✓</span>}
                </div>
                <p className="text-xs font-semibold text-gray-500">{provider.service_name || 'Service Expert'}</p>
            </div>
        </div>

        <div className="flex justify-between items-center border-t pt-3">
            <div className="flex items-center text-sm">
                <span className="text-amber-500 mr-1 text-lg font-extrabold">{parseFloat(provider.average_rating || 0).toFixed(1)}/5</span>
                <span className="ml-2 text-gray-500 text-xs">({provider.review_count || 0} reviews)</span>
            </div>
            <button className={`${DARK_CYAN_CLASS} text-white text-xs font-semibold px-4 py-1.5 rounded-lg ${DARK_CYAN_HOVER_CLASS} transition`}>
                View Profile
            </button>
        </div>
    </div>
);

const Spinner = () => <div className="flex justify-center items-center h-64"><div className={`animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 ${DARK_CYAN_TEXT_CLASS.replace('text', 'border')}`}></div></div>;
const ErrorMessage = ({ message }) => <div className="text-center text-red-700 bg-red-100 p-4 rounded-lg my-4 font-medium border border-red-300">{message}</div>;
const SuccessMessage = ({ message }) => <div className="text-center text-green-700 bg-green-100 p-4 rounded-lg my-4 font-medium border border-green-300">{message}</div>;

const HowItWorksCard = ({ icon, title, description, stars }) => (
    <div className="flex flex-col items-center text-center bg-white p-6 rounded-xl shadow-lg border border-gray-100 w-full">
        <div className={`text-4xl ${DARK_CYAN_TEXT_CLASS} mb-3`}>{icon}</div>
        <h3 className="text-lg font-semibold text-slate-800 mb-1">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
        {stars && <p className="text-amber-500 mt-1">{stars}</p>}
    </div>
);

// --- MODAL COMPONENTS ---

const Modal = ({ title, children, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 m-4 relative">
            <h2 className="text-2xl font-bold text-slate-800 mb-4 border-b pb-2">{title}</h2>
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-xl font-bold transition">
                &times;
            </button>
            {children}
        </div>
    </div>
);

const SetPriceModal = ({ booking, onClose, onPriceSet }) => {
    const { token } = useAuth();
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    const handleSetPrice = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const finalAmount = parseFloat(amount);
        if (isNaN(finalAmount) || finalAmount <= 0) {
            setError('Please enter a valid positive amount.');
            setLoading(false);
            return;
        }

        try {
            // Logic: Provider sets the price, moves status to 'awaiting_customer_confirmation'
            const response = await fetch(`${API_BASE_URL}/bookings/${booking.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ status: 'accepted', amount: finalAmount }),
            });
            const data = await response.json();

            if (response.ok) {
                setSuccess(`Price of ${CURRENCY_SYMBOL}${finalAmount.toFixed(2)} set. Customer notified for confirmation.`);
                setTimeout(() => onPriceSet(), 2000);
            } else {
                setError(data.error || 'Failed to set price.');
            }
        } catch (err) {
            setError('Network error occurred.');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Modal title={`Set Price for Booking #${booking.id}`} onClose={onClose}>
            <p className="text-gray-600 mb-4">Set the final service price. The customer must confirm this price before the booking status moves to 'Accepted'.</p>
            {error && <ErrorMessage message={error} />}
            {success && <SuccessMessage message={success} />}
            <form onSubmit={handleSetPrice} className="space-y-4">
                 <div>
                    <label htmlFor="amount" className="block text-sm font-semibold text-gray-700">Final Price ({CURRENCY_SYMBOL})</label>
                    <input 
                        id="amount" 
                        name="amount" 
                        type="number" 
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required 
                        className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg text-lg" 
                        placeholder="e.g., 5000.00"
                    />
                </div>
                <button type="submit" disabled={loading} className={`w-full ${DARK_CYAN_CLASS} text-white font-bold py-3 rounded-lg ${DARK_CYAN_HOVER_CLASS} transition disabled:bg-gray-400`}>
                    {loading ? 'Submitting Price...' : 'Submit Price & Await Confirmation'}
                </button>
            </form>
        </Modal>
    );
};


const BookingModal = ({ provider, service, onClose, onBooked, navigate }) => { 
    const { token, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleBookingSuccess = () => {
        onClose();
        navigate('customerDashboard');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        const bookingData = {
            provider_id: provider.id,
            service_id: service.id,
            scheduled_at: e.target.scheduled_at.value,
            address: e.target.address.value,
            customer_notes: e.target.customer_notes.value,
            service_description: e.target.service_description.value, 
        };

        try {
            const response = await fetch(`${API_BASE_URL}/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify(bookingData),
            });
            const data = await response.json();

            if (response.ok) {
                setSuccess(`Request sent! ID: ${data.booking_id}. Provider will review shortly.`);
                setTimeout(() => handleBookingSuccess(), 2000); 
            } else {
                setError(data.error || 'Failed to send booking request.');
            }
        } catch (err) {
            setError('Network error occurred during booking.');
        } finally {
            setLoading(false);
        }
    };

    if (!user) return <ErrorMessage message="You must be logged in to book a service." />;

    // Use default location from user profile
    const defaultLat = getProfileField(user, 'location_lat', 'N/A');
    const defaultLon = getProfileField(user, 'location_lon', 'N/A');
    const defaultAddress = getProfileField(user, 'address_line_1', '');
    const defaultCity = getProfileField(user, 'city', '');
    const fullAddress = defaultAddress + (defaultCity ? `, ${defaultCity}` : '');

    return (
        <Modal title={`Book ${service.name} with ${provider.display_name}`} onClose={onClose}>
            {error && <ErrorMessage message={error} />}
            {success && <SuccessMessage message={success} />}
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-gray-600">**Important:** Your default location is set to ({defaultLat}, {defaultLon}). Update it in your dashboard if needed.</p>
                <div>
                    <label htmlFor="scheduled_at" className="block text-sm font-semibold text-gray-700">Scheduled Date & Time</label>
                    <input id="scheduled_at" name="scheduled_at" type="datetime-local" required className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                    <label htmlFor="address" className="block text-sm font-semibold text-gray-700">Service Address</label>
                    <input id="address" name="address" type="text" defaultValue={fullAddress} required className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
                 <div>
                    <label htmlFor="service_description" className="block text-sm font-semibold text-gray-700">Detailed Service Description (What do you need done?)</label>
                    <textarea id="service_description" name="service_description" rows="3" required className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="e.g., Leaking faucet in the kitchen sink. Requires immediate attention."></textarea>
                </div>
                <div>
                    <label htmlFor="customer_notes" className="block text-sm font-semibold text-gray-700">Additional Notes (Optional)</label>
                    <textarea id="customer_notes" name="customer_notes" rows="2" className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg"></textarea>
                </div>
                <button type="submit" disabled={loading} className={`w-full ${DARK_CYAN_CLASS} text-white font-bold py-3 rounded-lg ${DARK_CYAN_HOVER_CLASS} transition disabled:bg-gray-400`}>
                    {loading ? 'Sending Request...' : 'Confirm & Send Request'}
                </button>
            </form>
        </Modal>
    );
};

const ReviewAndPaymentModal = ({ booking, onClose, onCompleted }) => {
    const { token, user } = useAuth();
    const [rating, setRating] = useState(0); 
    const [comment, setComment] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [isPaid, setIsPaid] = useState(booking.booking_status === 'closed');
    const [isReviewed, setIsReviewed] = useState(false); 
    
    useEffect(() => {
        setIsPaid(booking.booking_status === 'closed');
    }, [booking.booking_status]);

    const handlePayment = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_BASE_URL}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ booking_id: booking.id }), 
            });
            const data = await response.json();

            if (response.ok) {
                setSuccess(`Payment successful! Amount debited from your wallet. You can now optionally leave a review.`);
                setIsPaid(true);
                onCompleted(); 
            } else {
                setError(data.error || 'Payment failed. Check your wallet balance.');
            }
        } catch (err) {
            setError('Network error during payment processing.');
        } finally {
            setLoading(false);
        }
    };
    
    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        if (!isPaid) {
            setError('Please complete the payment first before submitting a review.');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ 
                    booking_id: booking.id, 
                    rating: rating, 
                    comment: comment 
                }),
            });
            const data = await response.json();
            
            if (response.ok) {
                setSuccess(data.message);
                setIsReviewed(true);
                onCompleted(); 
            } else {
                setError(data.error || 'Review submission failed. This booking may already be reviewed.');
            }
        } catch (err) {
            setError('Network error during review submission.');
        } finally {
            setLoading(false);
        }
    };
    
    // Star rating component for re-use
    const StarRating = () => (
        <div className="flex justify-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <span 
                    key={star} 
                    onClick={() => setRating(star)}
                    className={`cursor-pointer text-3xl transition ${star <= rating ? 'text-amber-400' : 'text-gray-300 hover:text-amber-300'}`}
                >
                    &#9733;
                </span>
            ))}
        </div>
    );
    
    const isPaymentPending = booking.booking_status === 'completed' && !isPaid;
    const isReadyToReview = isPaid && !isReviewed && booking.booking_status === 'closed'; // Only allow review if paid AND closed (final status)

    return (
        <Modal title={`Payment & Review for Booking #${booking.id}`} onClose={onClose}>
            {error && <ErrorMessage message={error} />}
            {success && <SuccessMessage message={success} />}

            {/* --- Payment Section (Only visible if not yet paid) --- */}
            {isPaymentPending && (
                <div className="bg-red-50 p-4 rounded-lg mb-4 border border-red-200">
                    <h3 className="text-xl font-bold text-red-700 mb-3">1. Complete Payment (Required)</h3>
                    <p className="mb-3 text-gray-700">
                        Final Service Fee: **{CURRENCY_SYMBOL}{parseFloat(booking.amount || 0).toFixed(2)}**
                    </p>
                    <button onClick={handlePayment} disabled={loading} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400">
                        {loading ? 'Processing...' : `Pay ${CURRENCY_SYMBOL}${parseFloat(booking.amount || 0).toFixed(2)} from Wallet`}
                    </button>
                </div>
            )}
            
            {/* --- Review Section (Only visible after successful payment or if already paid) --- */}
            {isReadyToReview && (
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <h3 className="text-xl font-bold text-amber-700 mb-3">2. Optional Review</h3>
                    <form onSubmit={handleReviewSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2 text-center">Your Rating</label>
                            <StarRating />
                            <p className="text-center text-sm text-gray-500 mt-1">({rating} out of 5)</p>
                        </div>
                        <div>
                            <label htmlFor="comment" className="block text-sm font-semibold text-gray-700">Comment (Optional)</label>
                            <textarea id="comment" name="comment" rows="3" value={comment} onChange={(e) => setComment(e.target.value)} className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Share your experience..."></textarea>
                        </div>
                        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400">
                            {loading ? 'Submitting...' : 'Submit Review (Optional)'}
                        </button>
                    </form>
                </div>
            )}
            
            {(booking.booking_status === 'closed' && !isReadyToReview) && (
                <SuccessMessage message="This booking is closed and payment is complete. You may have already submitted a review." />
            )}
            
            <div className="mt-4 text-right">
                <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 font-medium">Close</button>
            </div>

        </Modal>
    );
};

const PriceConfirmationModal = ({ booking, onClose, onConfirmed }) => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleConfirm = async (accepted) => {
        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_BASE_URL}/bookings/${booking.id}/confirm-price`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ accepted }),
            });
            const data = await response.json();

            if (response.ok) {
                setSuccess(data.message);
                setTimeout(() => onConfirmed(), 2000); 
            } else {
                setError(data.error || 'Failed to process confirmation.');
            }
        } catch (err) {
            setError('Network error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal title={`Confirm Price for Booking #${booking.id}`} onClose={onClose}>
            {error && <ErrorMessage message={error} />}
            {success && <SuccessMessage message={success} />}
            
            <div className="space-y-4">
                <p className="text-lg text-slate-800 font-semibold">
                    Provider's Quoted Price: 
                    <span className="text-green-600 ml-2 text-2xl font-bold">{CURRENCY_SYMBOL}{parseFloat(booking.amount || 0).toFixed(2)}</span>
                </p>
                <p className="text-gray-600">
                    If you accept, the service will be officially **Accepted**, and the chat will open for coordination. If you reject, the booking will be **Rejected** and cancelled.
                </p>
                
                <div className="flex space-x-4 pt-4">
                    <button 
                        onClick={() => handleConfirm(true)} 
                        disabled={loading}
                        className="flex-1 bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400"
                    >
                        {loading ? 'Confirming...' : 'Accept Price'}
                    </button>
                    <button 
                        onClick={() => handleConfirm(false)} 
                        disabled={loading}
                        className="flex-1 bg-red-500 text-white font-bold py-3 rounded-lg hover:bg-red-600 transition disabled:bg-gray-400"
                    >
                        Reject Price
                    </button>
                </div>
            </div>
        </Modal>
    );
};


const ChatComponent = ({ booking, onClose, isCustomer }) => {
    const { token, user, markMessagesAsRead } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [file, setFile] = useState(null); 
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sendLoading, setSendLoading] = useState(false);
    
    const messagesEndRef = React.useRef(null);
    
    const fetchMessages = useCallback(async () => {
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/bookings/${booking.id}/messages`, { 
                headers: { 'x-auth-token': token },
            });
            const data = await res.json();
            
            if (res.ok) {
                setMessages(data.messages || []);
            } else {
                setError(data.error || 'Failed to load chat history.');
            }
        } catch (err) {
            setError('Network error occurred during chat loading.');
        } finally {
            setLoading(false);
        }
    }, [booking.id, token]);

    useEffect(() => {
        setLoading(true);
        fetchMessages();
        markMessagesAsRead(booking.id); 
        
        const interval = setInterval(fetchMessages, 5000); 
        return () => clearInterval(interval);
        
    }, [fetchMessages, booking.id, markMessagesAsRead]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        
        if (!newMessage.trim() && !file) return;
        if (!token) return;
        
        setSendLoading(true);
        setError('');
        
        // Optimistic update
        const tempId = Date.now();
        const contentToSend = file ? `Uploading ${file.name}...` : newMessage.trim();
        
        setMessages(prev => [...prev, { 
            id: tempId, 
            sender_id: user.id, 
            sender_email: user.email,
            content: contentToSend, 
            file_url: file ? 'pending' : null,
            created_at: new Date().toISOString() 
        }]);
        setNewMessage('');
        
        let response;
        try {
            if (file) {
                // File Upload
                const formData = new FormData();
                formData.append('file', file);
                
                response = await fetch(`${API_BASE_URL}/bookings/${booking.id}/messages/upload`, {
                    method: 'POST',
                    headers: { 'x-auth-token': token },
                    body: formData,
                });
                setFile(null); // Clear file after submission attempt
            } else {
                // Text Message
                response = await fetch(`${API_BASE_URL}/bookings/${booking.id}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                    body: JSON.stringify({ content: contentToSend }),
                });
            }

            if (!response.ok) {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to send message/file.');
            } 
            
            // Refresh messages after send (polling will pick it up, but force-fetch for faster update)
            fetchMessages();
            
        } catch (err) {
            console.error('Network error during send:', err);
            setError('Network error occurred while sending message.');
        } finally {
            setSendLoading(false);
        }
    };
    
    const chatTitle = isCustomer 
        ? `Chat with ${booking.provider_name}`
        : `Chat with Customer (${booking.customer_email})`;
        
    const isChatActive = booking.booking_status === 'accepted' || booking.booking_status === 'closed' || booking.booking_status === 'completed';

    const renderFileContent = (msg) => {
        if (!msg.file_url) return null;

        // FIX: Check file extension for image, since backend returns a full URL
        const isImage = /\.(jpe?g|png|gif|webp)$/i.test(msg.file_url); 
        const fileName = msg.content.replace('File uploaded: ', '');

        return (
            <div className="mb-2 p-2 bg-white rounded-lg border border-gray-300">
                <p className="text-xs font-medium text-blue-600 mb-1">
                    Attached File
                </p>
                {isImage ? (
                     <img 
                        src={msg.file_url} 
                        alt="Attachment" 
                        className="max-w-full h-auto rounded-md cursor-pointer"
                    />
                ) : (
                    <p className="text-sm text-blue-500 truncate block font-mono">
                        {fileName}
                    </p>
                )}
                {/* Fallback for file messages without content */}
                <p className="text-sm mt-1">{msg.content}</p>
            </div>
        );
    }

    return (
        <Modal title={chatTitle} onClose={onClose}>
            {error && <ErrorMessage message={error} />}
            <div className="h-96 flex flex-col border border-gray-200 rounded-lg overflow-hidden">
                {/* Messages Window */}
                <div className="flex-grow p-4 overflow-y-auto bg-gray-50 space-y-3">
                    {loading ? (
                        <Spinner />
                    ) : messages.length === 0 ? (
                        <p className="text-center text-gray-500 pt-10">Start a conversation!</p>
                    ) : (
                        messages.map((msg, index) => {
                            const isSender = msg.sender_id === user.id;
                            return (
                                <div key={index} className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-xs md:max-w-md px-4 py-2 rounded-xl shadow-md ${isSender ? `${DARK_CYAN_CLASS} text-white rounded-br-none` : 'bg-gray-200 text-slate-800 rounded-tl-none'}`}>
                                        <p className="text-xs font-semibold mb-1 opacity-75">{isSender ? 'You' : msg.sender_email}</p>
                                        
                                        {msg.file_url && renderFileContent(msg)}
                                        {!msg.file_url && <p className="text-sm">{msg.content}</p>}
                                        
                                        <span className="text-xs block mt-1 text-right opacity-75">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>
                
                {/* Input Area */}
                <form onSubmit={handleSendMessage} className="p-4 bg-white border-t flex space-x-3 items-center">
                     {/* File Input Button */}
                    <label htmlFor="file-upload" className={`text-2xl cursor-pointer p-2 rounded-full transition ${isChatActive ? `${DARK_CYAN_TEXT_CLASS} hover:bg-gray-100` : 'text-gray-400'}`}>
                        &#x1F4F7;
                    </label>
                    <input 
                        id="file-upload" 
                        type="file"
                        onChange={(e) => setFile(e.target.files[0])}
                        className="hidden"
                        disabled={!isChatActive}
                        accept="image/*,application/pdf"
                    />
                    
                    <input 
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={isChatActive ? "Type your message..." : "Chat is disabled until accepted"}
                        className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                        disabled={!isChatActive || sendLoading || !!file}
                    />
                    
                    {file && (
                        <div className="text-sm bg-blue-100 p-2 rounded-lg flex items-center space-x-2">
                            <span>{file.name.length > 10 ? file.name.substring(0, 7) + '...' : file.name}</span>
                            <button type="button" onClick={() => setFile(null)} className="text-red-500 font-bold hover:text-red-700">&times;</button>
                        </div>
                    )}
                    
                    <button 
                        type="submit" 
                        className={`${DARK_CYAN_CLASS} text-white px-6 py-2 rounded-lg font-bold ${DARK_CYAN_HOVER_CLASS} transition disabled:bg-gray-400`}
                        disabled={(!newMessage.trim() && !file) || !isChatActive || sendLoading}
                    >
                        {sendLoading ? 'Sending...' : 'Send'}
                    </button>
                </form>
            </div>
            {!isChatActive && <p className="text-center text-sm text-red-500 mt-2">Chat is only active when the booking status is 'accepted', 'completed', or 'closed'.</p>}
        </Modal>
    );
};


const BookingCard = ({ booking, handleAction, isCustomer, onReviewModalOpen, onChatModalOpen, onPriceConfirmationOpen, onSetPriceOpen }) => {
    // Helper to determine color based on status
    const getStatusClasses = (status) => {
        switch (status) {
            case 'pending_provider': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'awaiting_customer_confirmation': return 'bg-purple-100 text-purple-800 border-purple-300 animate-pulse'; 
            case 'accepted': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'completed': return 'bg-red-100 text-red-800 border-red-300'; // Completed/Unpaid
            case 'closed': return 'bg-green-100 text-green-800 border-green-300'; // Paid/Closed
            case 'rejected': return 'bg-gray-200 text-gray-700 border-gray-400';
            default: return 'bg-gray-100 text-gray-600 border-gray-300';
        }
    };
    
    // Determine title based on role
    const title = isCustomer 
        ? `Provider: ${booking.provider_name || 'N/A'}`
        : `Customer: ${booking.customer_email || 'N/A'}`;
        
    const secondaryInfo = isCustomer 
        ? `Service: ${booking.service_name || 'N/A'}`
        : `Service: ${booking.service_name || 'N/A'}`;
        
    const amountDisplay = booking.amount ? `${CURRENCY_SYMBOL}${parseFloat(booking.amount).toFixed(2)}` : 'N/A';
    
    // Customer Actions
    const customerActions = (
        <div className="flex flex-col space-y-3">
            
            {/* Price Confirmation */}
            {booking.booking_status === 'awaiting_customer_confirmation' && (
                <button 
                    className="text-white px-4 py-2 rounded-lg font-semibold transition shadow-md bg-purple-600 hover:bg-purple-700"
                    onClick={() => onPriceConfirmationOpen(booking)}
                >
                    Review Price: {amountDisplay}
                </button>
            )}

            {/* Review & Payment button */}
            {booking.booking_status === 'completed' && (
                 <button 
                    className="text-white px-4 py-2 rounded-lg font-semibold transition shadow-md bg-red-500 hover:bg-red-600"
                    onClick={() => onReviewModalOpen(booking)}
                >
                    Pay & Review
                </button>
            )}
            
            {/* Chat button */}
            {(booking.booking_status === 'accepted' || booking.booking_status === 'closed' || booking.booking_status === 'completed') && (
                 <button 
                    className={`${DARK_CYAN_CLASS} text-white px-4 py-2 rounded-lg font-semibold ${DARK_CYAN_HOVER_CLASS} transition shadow-md`}
                    onClick={() => onChatModalOpen(booking)}
                >
                    Chat Now
                </button>
            )}
        </div>
    );
    
    // Provider Actions
    const providerActions = (
        <div className="flex flex-col space-y-3">
             {booking.booking_status === 'pending_provider' && (
                <div className="flex space-x-3">
                    <button 
                        onClick={() => onSetPriceOpen(booking)} 
                        className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition shadow-md"
                    >
                        Set Price & Accept
                    </button>
                    <button 
                        onClick={() => handleAction(booking.id, 'rejected')} 
                        className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition shadow-md"
                    >
                        Reject
                    </button>
                </div>
            )}
            
            {booking.booking_status === 'awaiting_customer_confirmation' && (
                <p className="text-purple-600 font-semibold text-center p-2 border border-purple-300 rounded-lg">Awaiting Customer Confirmation ({amountDisplay})</p>
            )}
            
            {booking.booking_status === 'accepted' && (
                 <div className="space-y-3">
                    <button 
                        onClick={() => handleAction(booking.id, 'completed')} 
                        className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition shadow-md"
                    >
                        Mark Completed (Awaiting Payment)
                    </button>
                    <button 
                        className={`${DARK_CYAN_CLASS} text-white px-4 py-2 rounded-lg font-semibold ${DARK_CYAN_HOVER_CLASS} transition shadow-md`}
                        onClick={() => onChatModalOpen(booking)}
                    >
                        Chat Now
                    </button>
                 </div>
            )}

            {(booking.booking_status === 'completed' || booking.booking_status === 'closed') && (
                 <button 
                    className={`${DARK_CYAN_CLASS} text-white px-4 py-2 rounded-lg font-semibold ${DARK_CYAN_HOVER_CLASS} transition shadow-md`}
                    onClick={() => onChatModalOpen(booking)}
                >
                    Chat Now / View
                </button>
            )}
            
            {(booking.booking_status === 'completed' || booking.booking_status === 'closed') && (
                <p className={`font-semibold text-sm text-center p-2 rounded-lg ${booking.booking_status === 'completed' ? 'text-red-500 bg-red-100' : 'text-green-600 bg-green-100'}`}>
                    Status: {booking.booking_status === 'completed' ? 'Awaiting Customer Payment' : 'PAID & CLOSED'}
                </p>
            )}

        </div>
    );

    
    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-6 mb-4 flex flex-col md:flex-row justify-between items-start md:items-center">
            <div className="flex-grow space-y-2">
                <div className="flex items-center space-x-3">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${getStatusClasses(booking.booking_status)} uppercase`}>
                        {booking.booking_status.replace('_', ' ')}
                    </span>
                    <p className="text-sm text-gray-500">Request ID: <span className="font-mono">{booking.id}</span></p>
                </div>
                
                <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                
                <div className="text-gray-600 text-sm">
                    <p className="font-medium text-slate-800">{secondaryInfo}</p>
                    <p>📅 **Scheduled:** {new Date(booking.scheduled_at).toLocaleString()}</p>
                    <p>📍 **Location:** {booking.address}</p>
                    {(booking.amount && booking.booking_status !== 'pending_provider') && <p className="font-bold text-blue-600">💰 **Price:** {amountDisplay}</p>}
                    {booking.service_description && (
                        <p className={`mt-2 p-2 bg-gray-50 border-l-4 ${DARK_CYAN_TEXT_CLASS.replace('text', 'border')}`}>Description: {booking.service_description}</p>
                    )}
                    {booking.customer_notes && (
                        <p className="mt-2 p-2 bg-gray-50 border-l-4 border-blue-400 italic">Notes: {booking.customer_notes}</p>
                    )}
                </div>
            </div>
            
            <div className="mt-4 md:mt-0">
                {isCustomer ? customerActions : providerActions}
            </div>
        </div>
    );
};


// --- CUSTOMER DASHBOARD COMPONENTS (Wallet, Bookings, Profile, etc.) ---

const CustomerProfileManagement = () => {
    const { user, token, fetchUserProfile } = useAuth();
    // Setting initial state: full_name should be empty string if null/undefined
    const [profileData, setProfileData] = useState({
        email: user?.email || '',
        full_name: getProfileField(user, 'full_name', ''), 
        phone_number: getProfileField(user, 'phone_number'),
        address_line_1: getProfileField(user, 'address_line_1'),
        city: getProfileField(user, 'city'),
        location_lat: getProfileField(user, 'location_lat', 0),
        location_lon: getProfileField(user, 'location_lon', 0),
    });
    
    const [profilePhotoFile, setProfilePhotoFile] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setProfileData({
                email: user.email || '',
                full_name: getProfileField(user, 'full_name', ''),
                phone_number: getProfileField(user, 'phone_number'),
                address_line_1: getProfileField(user, 'address_line_1'),
                city: getProfileField(user, 'city'),
                location_lat: getProfileField(user, 'location_lat', 0),
                location_lon: getProfileField(user, 'location_lon', 0),
            });
        }
    }, [user]);
    
    const handleChange = (e) => {
        setProfileData({ ...profileData, [e.target.name]: e.target.value });
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProfilePhotoFile(file);
        }
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess(''); setLoading(true);

        const dataToSend = {
             ...profileData,
             location_lat: parseFloat(profileData.location_lat),
             location_lon: parseFloat(profileData.location_lon),
        }
        
        try {
            // 1. Update text profile details
            let response = await fetch(`${API_BASE_URL}/user/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token,
                },
                body: JSON.stringify(dataToSend),
            });
            
            let data = await response.json();
            
            if (!response.ok) {
                 throw new Error(data.error || 'Failed to update basic profile.');
            }

            // 2. Upload photo if file exists
            if (profilePhotoFile) {
                const formData = new FormData();
                formData.append('profile_photo', profilePhotoFile);
                
                response = await fetch(`${API_BASE_URL}/user/profile-photo`, {
                    method: 'POST',
                    headers: { 'x-auth-token': token },
                    body: formData,
                });
                
                data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to upload profile photo.');
                }
            }
            
            setSuccess('Profile updated successfully! Refreshing data...');
            await fetchUserProfile(token); 
            setProfilePhotoFile(null); // Clear file input
            
        } catch (err) {
            setError(err.message || 'A network error occurred while submitting the update.');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-700">Account & Location Settings</h2>
            <p className="text-gray-600">Update your email, contact details, and default service location.</p>
            
            {error && <ErrorMessage message={error}/>}
            {success && <SuccessMessage message={success}/>}
            
            <form onSubmit={handleSubmit} className="space-y-6 bg-gray-50 p-6 rounded-xl border max-w-2xl">
                
                <h3 className={`text-lg font-semibold ${DARK_CYAN_TEXT_CLASS} border-b pb-2`}>Profile Picture</h3>
                <div className="flex items-center space-x-6">
                    <img 
                        src={profilePhotoFile ? URL.createObjectURL(profilePhotoFile) : getPhotoUrl(user)} 
                        alt="Current Profile" 
                        className="w-24 h-24 rounded-full object-cover shadow-lg border-4 border-white ring-2 ring-cyan-500" 
                    />
                    <div>
                        <input 
                            id="profile_photo"
                            type="file" 
                            accept="image/*"
                            onChange={handlePhotoChange}
                            className="text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"
                            disabled={loading}
                        />
                        {profilePhotoFile && <p className="text-sm text-green-600 mt-1">Ready to upload: {profilePhotoFile.name}</p>}
                    </div>
                </div>

                <h3 className={`text-lg font-semibold ${DARK_CYAN_TEXT_CLASS} border-b pb-2 pt-4`}>Account Details</h3>
                <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700">Email Address (Login)</label>
                    <input 
                        id="email" 
                        name="email" 
                        type="email" 
                        value={profileData.email}
                        onChange={handleChange}
                        required 
                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition" 
                        disabled={loading}
                    />
                </div>

                <h3 className={`text-lg font-semibold ${DARK_CYAN_TEXT_CLASS} border-b pb-2 pt-4`}>Personal Details</h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="full_name" className="block text-sm font-semibold text-gray-700">Full Name</label>
                        <input 
                            id="full_name" 
                            name="full_name" 
                            type="text" 
                            value={profileData.full_name} 
                            onChange={handleChange} 
                            className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" 
                        />
                    </div>
                    <div>
                        <label htmlFor="phone_number" className="block text-sm font-semibold text-gray-700">Phone Number</label>
                        <input id="phone_number" name="phone_number" type="tel" value={profileData.phone_number} onChange={handleChange} className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" />
                    </div>
                </div>
                
                <h3 className={`text-lg font-semibold ${DARK_CYAN_TEXT_CLASS} border-b pb-2 pt-4`}>Default Location</h3>
                 <div>
                    <label htmlFor="address_line_1" className="block text-sm font-semibold text-gray-700">Address Line 1</label>
                    <input id="address_line_1" name="address_line_1" type="text" value={profileData.address_line_1} onChange={handleChange} className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="city" className="block text-sm font-semibold text-gray-700">City</label>
                        <input id="city" name="city" type="text" value={profileData.city} onChange={handleChange} className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" />
                    </div>
                    <div>
                        <label htmlFor="location_lat" className="block text-sm font-semibold text-gray-700">Latitude</label>
                        <input id="location_lat" name="location_lat" type="number" step="any" value={profileData.location_lat} onChange={handleChange} required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" />
                    </div>
                    <div>
                        <label htmlFor="location_lon" className="block text-sm font-semibold text-gray-700">Longitude</label>
                        <input id="location_lon" name="location_lon" type="number" step="any" value={profileData.location_lon} onChange={handleChange} required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" />
                    </div>
                </div>

                <p className="text-sm text-gray-500">Your Role: <span className={`font-semibold ${DARK_CYAN_TEXT_CLASS}`}>{user?.role?.toUpperCase()}</span></p>
                
                <button type="submit" disabled={loading} className={`w-full ${DARK_CYAN_CLASS} text-white font-bold py-3 rounded-lg ${DARK_CYAN_HOVER_CLASS} transition shadow-md disabled:bg-gray-400`}>
                    {loading ? 'Saving...' : 'Update Profile'}
                </button>
            </form>
        </div>
    );
}

const CustomerWallet = ({ fetchBookings }) => {
    const { token, user } = useAuth();
    const [balance, setBalance] = useState(0);
    const [depositAmount, setDepositAmount] = useState('');
    const [depositTxnRef, setDepositTxnRef] = useState('');
    const [screenshotFile, setScreenshotFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [depositLoading, setDepositLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

    const fetchWallet = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/user/wallet`, { headers: { 'x-auth-token': token } });
            if (res.ok) {
                const data = await res.json();
                setBalance(data.balance);
                setPendingRequestsCount(data.pending_requests_count || 0);
            } else {
                setError('Failed to fetch wallet data.');
            }
        } catch (err) {
            setError('Network error fetching wallet.');
        } finally {
            setLoading(false);
        }
    }, [token]);
    
    useEffect(() => {
        fetchWallet();
    }, [fetchWallet]);
    
    const handleDepositRequest = async (e) => {
        e.preventDefault();
        setDepositLoading(true);
        setError(''); setSuccess('');
        const amount = parseFloat(depositAmount);

        if (isNaN(amount) || amount <= 0) {
            setError('Please enter a valid positive amount.');
            setDepositLoading(false);
            return;
        }
        if (!depositTxnRef) {
            setError('Please enter the UPI transaction reference.');
            setDepositLoading(false);
            return;
        }
        if (!screenshotFile) {
            setError('Please upload the payment screenshot.');
            setDepositLoading(false);
            return;
        }
        
        const formData = new FormData();
        formData.append('amount', amount);
        formData.append('transaction_reference', depositTxnRef);
        formData.append('screenshot_file', screenshotFile);

        try {
            const response = await fetch(`${API_BASE_URL}/customer/wallet/deposit-request`, {
                method: 'POST',
                headers: { 'x-auth-token': token },
                body: formData,
            });
            const data = await response.json();
            
            if (response.ok) {
                setSuccess(data.message);
                setDepositAmount('');
                setDepositTxnRef('');
                setScreenshotFile(null);
                await fetchWallet();
            } else {
                setError(data.error || 'Deposit request failed.');
            }
        } catch (err) {
            setError('Network error during deposit request.');
        } finally {
            setDepositLoading(false);
        }
    };


    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-700">My Wallet</h2>
            
            <div className={`${DARK_CYAN_CLASS} text-white p-6 rounded-xl shadow-lg border-2 border-cyan-800 flex justify-between items-center`}>
                <div>
                    <p className="text-sm font-medium opacity-90">Current Balance</p>
                    {pendingRequestsCount > 0 && <p className="text-xs font-medium text-yellow-300">{pendingRequestsCount} Deposit Request(s) Pending Admin Approval</p>}
                </div>
                {loading ? <p className="text-2xl font-extrabold">Loading...</p> : (
                    <h3 className="text-4xl font-extrabold">{CURRENCY_SYMBOL}{balance.toFixed(2)}</h3>
                )}
            </div>
            
            <div className="bg-gray-50 p-6 rounded-xl border max-w-4xl">
                <h3 className={`text-xl font-semibold ${DARK_CYAN_TEXT_CLASS} mb-4 border-b pb-2`}>Deposit Funds (Admin Approval Required)</h3>
                
                <div className="flex flex-col md:flex-row gap-6">
                    {/* QR Code and Instructions */}
                    <div className="md:w-1/2 text-center bg-white p-4 rounded-lg shadow-inner border border-gray-100">
                        <p className="font-bold text-lg mb-2 text-cyan-700">Step 1: Pay to Platform UPI ID</p>
                        <img 
                            src={MOCK_UPI_QR_CODE_URL} 
                            alt="Mock UPI QR Code" 
                            className="w-40 h-40 mx-auto object-contain border-4 border-gray-200 rounded-lg mb-2" 
                        />
                        <p className="text-sm text-gray-600">Scan this code using any UPI App and complete your payment.</p>
                        <p className="text-xs text-red-500 mt-2 font-medium">NOTE: Payment is sent to the **Platform Admin**. Funds are not available until Admin verifies the transaction proof.</p>
                    </div>

                    {/* Deposit Request Form */}
                    <div className="md:w-1/2">
                        <p className="font-bold text-lg mb-4 text-cyan-700 border-b pb-1">Step 2: Submit Proof</p>
                        {error && <ErrorMessage message={error}/>}
                        {success && <SuccessMessage message={success}/>}
                        <form onSubmit={handleDepositRequest} className="space-y-4">
                             <div>
                                <label className="block text-sm font-semibold text-gray-700">Amount Paid ({CURRENCY_SYMBOL})</label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                    required
                                    placeholder={`${CURRENCY_SYMBOL} 500.00`}
                                    className="block w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    disabled={depositLoading}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700">UPI Transaction Reference/ID</label>
                                <input 
                                    type="text" 
                                    value={depositTxnRef}
                                    onChange={(e) => setDepositTxnRef(e.target.value)}
                                    required
                                    placeholder="E.g., 510425378214"
                                    className="block w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    disabled={depositLoading}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700">Payment Screenshot Proof</label>
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={(e) => setScreenshotFile(e.target.files[0])}
                                    required
                                    className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700"
                                    disabled={depositLoading}
                                />
                            </div>
                            <button type="submit" disabled={depositLoading} className="w-full bg-blue-600 text-white font-bold px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400">
                                {depositLoading ? 'Submitting Proof...' : 'Request Wallet Deposit'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};


const CustomerFindServices = ({ setPage }) => (
    <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-700">Find New Services</h2>
        <p className="text-gray-600">Need help with a home repair, maintenance, or consultation? Find trusted local professionals here.</p>
        
        <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <p className="text-lg font-semibold text-blue-800">Explore all categories now!</p>
            <button 
                onClick={() => setPage('allServices')}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-md w-full sm:w-auto"
            >
                Browse Services
            </button>
        </div>
    </div>
);


const CustomerBookingHistory = () => {
    const { token, user } = useAuth();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeModal, setActiveModal] = useState(null);
    const [selectedBooking, setSelectedBooking] = useState(null);
    
    const fetchBookings = useCallback(async () => {
        if (!token || user?.role !== 'customer') return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/customer/bookings`, { 
                headers: { 'x-auth-token': token },
            });
            
            if (!res.ok) {
                 const errorText = await res.json();
                 throw new Error(errorText.error || `Failed to fetch bookings. Status: ${res.status}`);
            }
            
            const data = await res.json();
            setBookings(data.bookings || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token, user]);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);
    
    const handleReviewModalOpen = (booking) => {
        setSelectedBooking(booking);
        setActiveModal('review');
    };
    
    const handleChatModalOpen = (booking) => {
        setSelectedBooking(booking);
        setActiveModal('chat');
    };
    
    const handlePriceConfirmationOpen = (booking) => {
        setSelectedBooking(booking);
        setActiveModal('confirmPrice');
    };


    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-700">Your Booking History</h2>
            <p className="text-gray-600">Track the status of your requested services and access chat and payment options.</p>
            
            {error && <ErrorMessage message={error}/>}
            {loading && <Spinner />}
            
            {!loading && bookings.length === 0 && <p className="text-center text-gray-500 bg-gray-100 p-10 rounded-xl shadow-inner">
                You haven't placed any bookings yet. Find a service now!
            </p>}

            {bookings.map(booking => (
                <BookingCard 
                    key={booking.id} 
                    booking={booking} 
                    isCustomer={true} 
                    handleAction={() => {}}
                    onReviewModalOpen={handleReviewModalOpen}
                    onChatModalOpen={handleChatModalOpen}
                    onPriceConfirmationOpen={handlePriceConfirmationOpen} 
                />
            ))}
            
            {activeModal === 'review' && selectedBooking && (
                <ReviewAndPaymentModal 
                    booking={selectedBooking} 
                    onClose={() => setActiveModal(null)} 
                    onCompleted={fetchBookings} 
                />
            )}
            
            {activeModal === 'chat' && selectedBooking && (
                <ChatComponent
                    booking={selectedBooking}
                    onClose={() => setActiveModal(null)} 
                    isCustomer={true}
                />
            )}
            
            {activeModal === 'confirmPrice' && selectedBooking && (
                <PriceConfirmationModal
                    booking={selectedBooking}
                    onClose={() => setActiveModal(null)}
                    onConfirmed={fetchBookings} 
                />
            )}
        </div>
    );
};


const CustomerDashboard = ({ setPage }) => {
    const [activeTab, setActiveTab] = useState('bookings');
    const navItems = [
        { tab: 'bookings', label: 'My Bookings' },
        { tab: 'wallet', label: 'My Wallet' }, 
        { tab: 'findServices', label: 'Find a Service' }, 
        { tab: 'profile', label: 'My Profile' },
    ];
    
    const renderTab = () => {
        switch (activeTab) {
            case 'bookings': return <CustomerBookingHistory />;
            case 'wallet': return <CustomerWallet />;
            case 'profile': return <CustomerProfileManagement />;
            case 'findServices': return <CustomerFindServices setPage={setPage} />;
            default: return <CustomerBookingHistory />;
        }
    }
    
    return (
        <DashboardLayout navItems={navItems} activeTab={activeTab} setActiveTab={setActiveTab} title="Customer Dashboard">
            {renderTab()}
        </DashboardLayout>
    );
};


const ProviderWalletAndEarnings = () => {
    const { token } = useAuth();
    const [analytics, setAnalytics] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawPayoutDetails, setWithdrawPayoutDetails] = useState(''); // Holds UPI/Bank info
    const [withdrawLoading, setWithdrawLoading] = useState(false);
    const [withdrawError, setWithdrawError] = useState('');
    const [withdrawSuccess, setWithdrawSuccess] = useState('');
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/provider/earnings`, { 
                headers: { 'x-auth-token': token },
            });
            
            if (!res.ok) {
                 const errorText = await res.json();
                 throw new Error(errorText.error || `Failed to fetch earnings.`);
            }
            
            const data = await res.json();
            setAnalytics(data.analytics || {});
            
            // Fetch pending requests count separately for provider
            const walletRes = await fetch(`${API_BASE_URL}/user/wallet`, { headers: { 'x-auth-token': token } });
            if (walletRes.ok) {
                const walletData = await walletRes.json();
                setPendingRequestsCount(walletData.pending_requests_count || 0);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);
    
    const handleWithdrawRequest = async (e) => {
        e.preventDefault();
        setWithdrawLoading(true);
        setWithdrawError(''); setWithdrawSuccess('');
        const amount = parseFloat(withdrawAmount);

        if (isNaN(amount) || amount <= 0) {
            setWithdrawError('Please enter a valid amount.');
            setWithdrawLoading(false);
            return;
        }
        if (!withdrawPayoutDetails) {
            setWithdrawError('Please enter your UPI ID or Bank Account details.');
            setWithdrawLoading(false);
            return;
        }
        if (amount > analytics.wallet_balance) {
            setWithdrawError('Withdrawal amount exceeds current wallet balance.');
            setWithdrawLoading(false);
            return;
        }


        try {
            const response = await fetch(`${API_BASE_URL}/provider/wallet/withdraw-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ 
                    amount,
                    transaction_reference: withdrawPayoutDetails // Using txn_ref to hold UPI/Bank details
                }),
            });
            const data = await response.json();
            
            if (response.ok) {
                setWithdrawSuccess(data.message);
                setWithdrawAmount('');
                setWithdrawPayoutDetails('');
                await fetchAnalytics(); 
            } else {
                setWithdrawError(data.error || 'Withdrawal request failed. Check balance.');
            }
        } catch (err) {
            setWithdrawError('Network error during withdrawal request.');
        } finally {
            setWithdrawLoading(false);
        }
    };
    
    if (loading) return <Spinner />;
    if (error) return <ErrorMessage message={error} />;

    
    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-slate-700">Your Payouts & Performance Analytics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <div className="bg-[#E0F7FA] text-[#008080] p-6 rounded-xl shadow-lg border border-[#B2EBF2]">
                    <p className="text-sm font-medium">Wallet Balance</p>
                    <h3 className="text-3xl font-extrabold mt-1">{CURRENCY_SYMBOL}{analytics.wallet_balance?.toFixed(2) || '0.00'}</h3>
                    {pendingRequestsCount > 0 && <p className="text-xs font-medium text-red-500">{pendingRequestsCount} Withdrawal Request(s) Pending Admin Approval</p>}
                </div>
                <div className="bg-green-100 text-green-800 p-6 rounded-xl shadow-lg border border-green-300">
                    <p className="text-sm font-medium">Total Lifetime Earnings</p>
                    {/* FIX: This now correctly shows total money credited from payments/deposits */}
                    <h3 className="text-3xl font-extrabold mt-1">{CURRENCY_SYMBOL}{analytics.total_earnings?.toFixed(2) || '0.00'}</h3>
                </div>
                <div className="bg-blue-100 text-blue-800 p-6 rounded-xl shadow-lg border border-blue-300">
                    <p className="text-sm font-medium">Completed Jobs</p>
                    <h3 className="text-3xl font-extrabold mt-1">{analytics.completed_jobs || 0}</h3>
                </div>
                <div className="bg-amber-100 text-amber-800 p-6 rounded-xl shadow-lg border border-amber-300">
                    <p className="text-sm font-medium">Average Rating</p>
                    <h3 className="text-3xl font-extrabold mt-1">⭐ {analytics.average_rating?.toFixed(2) || '0.00'}</h3>
                </div>
            </div>
            
             <div className="bg-gray-50 p-6 rounded-xl border max-w-2xl">
                <h3 className={`text-xl font-semibold ${DARK_CYAN_TEXT_CLASS} mb-4 border-b pb-2`}>Withdraw Funds Request (Admin Approval Required)</h3>
                {withdrawError && <ErrorMessage message={withdrawError}/>}
                {withdrawSuccess && <SuccessMessage message={withdrawSuccess}/>}
                <p className="text-sm text-gray-600 mb-4">Transfer funds from your wallet to your linked UPI/bank account. This requires admin verification.</p>
                <form onSubmit={handleWithdrawRequest} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700">Withdraw Amount ({CURRENCY_SYMBOL})</label>
                        <input 
                            type="number" 
                            step="0.01" 
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            required
                            placeholder={`${CURRENCY_SYMBOL} Amount`}
                            className="block w-full px-4 py-2 border border-gray-300 rounded-lg"
                            disabled={withdrawLoading}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700">UPI ID or Bank Details</label>
                         <input 
                            type="text" 
                            value={withdrawPayoutDetails}
                            onChange={(e) => setWithdrawPayoutDetails(e.target.value)}
                            required
                            placeholder="E.g., upi_id@bank or A/C:1234, IFSC: ABCD"
                            className="block w-full px-4 py-2 border border-gray-300 rounded-lg"
                            disabled={withdrawLoading}
                        />
                        <p className="text-xs text-gray-500 mt-1">Funds will be sent to these details upon approval.</p>
                    </div>

                    <button type="submit" disabled={withdrawLoading} className="w-full bg-red-600 text-white font-bold px-6 py-3 rounded-lg hover:bg-red-700 transition disabled:bg-gray-400">
                        {withdrawLoading ? 'Processing Request...' : 'Request Withdrawal'}
                    </button>
                </form>
            </div>
        </div>
    );
};


const ProviderDashboard = () => {
    const [activeTab, setActiveTab] = useState('bookings');
     const navItems = [
        { tab: 'bookings', label: 'Booking Requests' },
        { tab: 'earnings', label: 'Earnings & Payments' },
        { tab: 'profile', label: 'Profile Management' },
    ];
    
    const renderTab = () => {
        switch (activeTab) {
            case 'bookings': return <ProviderBookingRequests />;
            case 'earnings': return <ProviderWalletAndEarnings />;
            case 'profile': return <ProviderProfileManagement />;
            default: return <ProviderBookingRequests />;
        }
    };
    
    return (
        <DashboardLayout navItems={navItems} activeTab={activeTab} setActiveTab={setActiveTab} title="Provider Dashboard">
            {renderTab()}
        </DashboardLayout>
    );
};


const ProviderBookingRequests = () => {
    const { token } = useAuth();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updateStatus, setUpdateStatus] = useState(null);
    const [activeModal, setActiveModal] = useState(null);
    const [selectedBooking, setSelectedBooking] = useState(null);

    const fetchBookings = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/provider/bookings`, { 
                headers: { 'x-auth-token': token },
            });
            
            if (!res.ok) {
                 const errorText = await res.json();
                 throw new Error(errorText.error || `Failed to fetch bookings. Status: ${res.status}`);
            }
            
            const data = await res.json();
            setBookings(data.bookings || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    const handleAction = async (bookingId, status) => {
        setUpdateStatus({ id: bookingId, loading: true });
        setError('');
        try {
            const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token,
                },
                body: JSON.stringify({ status }),
            });
            
            if (!response.ok) {
                const errorText = await response.json();
                throw new Error(errorText.error || `Action failed for booking ${bookingId}. Status: ${response.status}`);
            }
            
            const data = await response.json();
            if (response.ok) {
                fetchBookings();
                setUpdateStatus({ id: bookingId, success: true, message: data.message });
            } 
        } catch (err) {
            setError('Network error during booking update.');
        } finally {
            setUpdateStatus(null);
        }
    };
    
    const handleChatModalOpen = (booking) => {
        setSelectedBooking(booking);
        setActiveModal('chat');
    };
    
    const handleSetPriceOpen = (booking) => {
        setSelectedBooking(booking);
        setActiveModal('setPrice');
    };

    const pendingBookings = bookings.filter(b => b.booking_status === 'pending_provider' || b.booking_status === 'awaiting_customer_confirmation' || b.booking_status === 'accepted');
    const historyBookings = bookings.filter(b => b.booking_status === 'rejected' || b.booking_status === 'completed' || b.booking_status === 'closed');

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-700">Incoming Booking Requests & Schedule</h2>
            
            {error && <ErrorMessage message={error}/>}
            {updateStatus && updateStatus.success && <SuccessMessage message={updateStatus.message} />}

            <h3 className="text-xl font-semibold text-slate-800 border-b pb-2 mt-8">Active/Pending ({pendingBookings.length})</h3>
            {loading && pendingBookings.length === 0 && <Spinner />}
            {!loading && pendingBookings.length === 0 && <p className="text-gray-500 p-4 bg-blue-50 rounded-lg border">You have no active or pending booking requests right now. Time for a break!</p>}

            {pendingBookings.map(booking => (
                <BookingCard 
                    key={booking.id} 
                    booking={booking} 
                    isCustomer={false} 
                    handleAction={handleAction} 
                    onChatModalOpen={handleChatModalOpen}
                    onSetPriceOpen={handleSetPriceOpen} 
                />
            ))}
            
            <h3 className="text-xl font-semibold text-slate-800 border-b pb-2 mt-10">Booking History ({historyBookings.length})</h3>
            {historyBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} isCustomer={false} handleAction={() => {}} onChatModalOpen={handleChatModalOpen}/>
            ))}
            
            {activeModal === 'chat' && selectedBooking && (
                <ChatComponent
                    booking={selectedBooking}
                    onClose={() => setActiveModal(null)} 
                    isCustomer={false}
                />
            )}
            
            {activeModal === 'setPrice' && selectedBooking && (
                <SetPriceModal
                    booking={selectedBooking}
                    onClose={() => setActiveModal(null)}
                    onPriceSet={fetchBookings} 
                />
            )}

        </div>
    );
};


const ProviderProfileManagement = () => {
    const { user, token, fetchUserProfile } = useAuth();
    const [profile, setProfile] = useState(null);
    const [services, setServices] = useState([]);
    const [profilePhotoFile, setProfilePhotoFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // FIX: useCallback ensures this function definition is stable, preventing re-render loop ("blinking")
    const fetchData = useCallback(async () => {
        if (!token || user?.role !== 'provider') {
             setLoading(false);
             return;
        }
        setLoading(true);
        setError('');
        
        try {
            const res = await fetch(`${API_BASE_URL}/provider/profile`, {
                headers: { 'x-auth-token': token },
            });
            
            if (!res.ok) {
                const errorText = await res.json(); 
                throw new Error(errorText.error || `Failed to fetch profile. Status: ${res.status}`);
            }
            const profileData = await res.json();
            setProfile(profileData.provider_profile);
            
            const servicesRes = await fetch(`${API_BASE_URL}/services`);
            const servicesData = await servicesRes.json();
            setServices(servicesData || []);

            // Refresh main user profile to ensure photo URL is latest
            await fetchUserProfile(token);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token, user, fetchUserProfile]); // Only run when these dependencies change

    useEffect(() => {
        // FIX: The component now relies entirely on the stable fetchData function
        fetchData();
    }, [fetchData]);

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProfilePhotoFile(file);
        }
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess(''); setLoading(true);
        const formData = new FormData(e.target);
        
        const serviceIds = formData.get('primary_service_id') ? [formData.get('primary_service_id')] : [];
        
        if (serviceIds.length === 0) {
            setError('Please select a primary service category.');
            setLoading(false);
            return;
        }
        
        const profileData = {
            display_name: formData.get('display_name'),
            bio: formData.get('bio'),
            location_lat: parseFloat(formData.get('location_lat')),
            location_lon: parseFloat(formData.get('location_lon')),
            service_radius_km: parseInt(formData.get('service_radius_km'), 10),
            service_ids: serviceIds,
            payout_upi_id: formData.get('payout_upi_id')
        };
        
        try {
            // 1. Update text profile details (including UPI)
            let response = await fetch(`${API_BASE_URL}/provider/profile`, {
                method: 'POST', 
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token,
                },
                body: JSON.stringify(profileData),
            });
            
            let data = await response.json();
            
            if (!response.ok) {
                 throw new Error(data.error || 'Failed to update basic profile.');
            }

            // 2. Upload photo if file exists
            if (profilePhotoFile) {
                const photoFormData = new FormData();
                photoFormData.append('profile_photo', profilePhotoFile);
                
                response = await fetch(`${API_BASE_URL}/user/profile-photo`, {
                    method: 'POST',
                    headers: { 'x-auth-token': token },
                    body: photoFormData,
                });
                
                data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to upload profile photo.');
                }
            }

            setSuccess('Profile updated successfully!');
            await fetchData(); // Refresh data
            setProfilePhotoFile(null);
            
        } catch (err) {
            setError(err.message || 'A network error occurred while submitting the update.');
        } finally {
            setLoading(false);
        }
    };
    
    if (loading) return <Spinner />;
    if (error && !profile) return <ErrorMessage message={error} />;
    if (!profile) return <ErrorMessage message="Provider profile data is missing. Please contact support or complete initial setup." />;

    const currentServiceId = profile.service_ids && profile.service_ids.length > 0 
        ? profile.service_ids[0] 
        : (services[0]?.id || '');
    
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-700">Manage Your Public Profile</h2>
            
            {error && <ErrorMessage message={error}/>}
            {success && <SuccessMessage message={success}/>}
            
            <form onSubmit={handleSubmit} className="space-y-6 bg-gray-50 p-6 rounded-xl border">
                
                <h3 className={`text-lg font-semibold ${DARK_CYAN_TEXT_CLASS} border-b pb-2`}>Profile Picture</h3>
                <div className="flex items-center space-x-6">
                    <img 
                        src={profilePhotoFile ? URL.createObjectURL(profilePhotoFile) : getPhotoUrl(user)} 
                        alt="Current Profile" 
                        className="w-24 h-24 rounded-full object-cover shadow-lg border-4 border-white ring-2 ring-cyan-500" 
                    />
                    <div>
                        <input 
                            id="profile_photo"
                            type="file" 
                            accept="image/*"
                            onChange={handlePhotoChange}
                            className="text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"
                            disabled={loading}
                        />
                        {profilePhotoFile && <p className="text-sm text-green-600 mt-1">Ready to upload: {profilePhotoFile.name}</p>}
                    </div>
                </div>

                <h3 className={`text-lg font-semibold ${DARK_CYAN_TEXT_CLASS} border-b pb-2`}>Basic Details</h3>
                <div>
                    <label htmlFor="display_name" className="block text-sm font-semibold text-gray-700">Display Name</label>
                    <input id="display_name" name="display_name" type="text" defaultValue={profile.display_name} required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" />
                </div>
                
                 <div>
                    <label htmlFor="primary_service_id" className="block text-sm font-semibold text-gray-700">Primary Service Category</label>
                    <select id="primary_service_id" name="primary_service_id" defaultValue={currentServiceId} required 
                        className="mt-1 block w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition">
                        {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                
                <div>
                    <label htmlFor="bio" className="block text-sm font-semibold text-gray-700">Short Bio / Expertise Summary</label>
                    <textarea id="bio" name="bio" rows="4" defaultValue={profile.bio} required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" placeholder="Describe your services and experience (Max 250 chars)..."></textarea>
                </div>
                
                <h3 className={`text-lg font-semibold ${DARK_CYAN_TEXT_CLASS} border-b pb-2`}>Service Area</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div>
                        <label htmlFor="location_lat" className="block text-sm font-semibold text-gray-700">Location Latitude (Home Base)</label>
                        <input id="location_lat" name="location_lat" type="number" step="any" defaultValue={profile.location_lat} required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" />
                    </div>
                     <div>
                        <label htmlFor="location_lon" className="block text-sm font-semibold text-gray-700">Location Longitude</label>
                        <input id="location_lon" name="location_lon" type="number" step="any" defaultValue={profile.location_lon} required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" />
                    </div>
                     <div>
                        <label htmlFor="service_radius_km" className="block text-sm font-semibold text-gray-700">Service Radius (km)</label>
                        <input id="service_radius_km" name="service_radius_km" type="number" defaultValue={profile.service_radius_km} required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" />
                    </div>
                </div>

                <h3 className={`text-lg font-semibold ${DARK_CYAN_TEXT_CLASS} border-b pb-2`}>Payout Details</h3>
                <div>
                    <label htmlFor="payout_upi_id" className="block text-sm font-semibold text-gray-700">Primary Payout UPI ID / Bank Details</label>
                    <input id="payout_upi_id" name="payout_upi_id" type="text" defaultValue={profile.payout_upi_id} required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" placeholder="E.g., yourname@bank or A/C: 1234"/>
                </div>
                
                <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-md disabled:bg-gray-400">
                    {loading ? 'Saving Profile...' : 'Save Profile Updates'}
                </button>
            </form>
        </div>
    );
};


// --- ADMIN COMPONENTS ---

const AdminProfileManagement = () => {
    const { user, token, fetchUserProfile } = useAuth();
    const [profileData, setProfileData] = useState({
        email: user?.email || '',
    });
    
    const [profilePhotoFile, setProfilePhotoFile] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setProfileData({
                email: user.email || '',
            });
        }
    }, [user]);
    
    const handleChange = (e) => {
        setProfileData({ ...profileData, [e.target.name]: e.target.value });
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProfilePhotoFile(file);
        }
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess(''); setLoading(true);

        const dataToSend = { ...profileData };
        
        try {
            // 1. Update user email (only change for admin)
            let response = await fetch(`${API_BASE_URL}/user/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token,
                },
                body: JSON.stringify(dataToSend),
            });
            
            let data = await response.json();
            
            if (!response.ok) {
                 throw new Error(data.error || 'Failed to update email.');
            }

            // 2. Upload photo if file exists
            if (profilePhotoFile) {
                const formData = new FormData();
                formData.append('profile_photo', profilePhotoFile);
                
                response = await fetch(`${API_BASE_URL}/user/profile-photo`, {
                    method: 'POST',
                    headers: { 'x-auth-token': token },
                    body: formData,
                });
                
                data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to upload profile photo.');
                }
            }
            
            setSuccess('Admin Profile updated successfully! Refreshing data...');
            await fetchUserProfile(token); 
            setProfilePhotoFile(null);
            
        } catch (err) {
            setError(err.message || 'A network error occurred while submitting the update.');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-700">Admin Account Settings</h2>
            <p className="text-gray-600">Update your email and profile picture.</p>
            
            {error && <ErrorMessage message={error}/>}
            {success && <SuccessMessage message={success}/>}
            
            <form onSubmit={handleSubmit} className="space-y-6 bg-gray-50 p-6 rounded-xl border max-w-2xl">
                
                <h3 className={`text-lg font-semibold ${DARK_CYAN_TEXT_CLASS} border-b pb-2`}>Profile Picture</h3>
                <div className="flex items-center space-x-6">
                    <img 
                        src={profilePhotoFile ? URL.createObjectURL(profilePhotoFile) : getPhotoUrl(user)} 
                        alt="Current Profile" 
                        className="w-24 h-24 rounded-full object-cover shadow-lg border-4 border-white ring-2 ring-cyan-500" 
                    />
                    <div>
                        <input 
                            id="profile_photo"
                            type="file" 
                            accept="image/*"
                            onChange={handlePhotoChange}
                            className="text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"
                            disabled={loading}
                        />
                        {profilePhotoFile && <p className="text-sm text-green-600 mt-1">Ready to upload: {profilePhotoFile.name}</p>}
                    </div>
                </div>

                <h3 className={`text-lg font-semibold ${DARK_CYAN_TEXT_CLASS} border-b pb-2 pt-4`}>Account Details</h3>
                <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700">Email Address (Login)</label>
                    <input 
                        id="email" 
                        name="email" 
                        type="email" 
                        value={profileData.email}
                        onChange={handleChange}
                        required 
                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition" 
                        disabled={loading}
                    />
                </div>
                
                <p className="text-sm text-gray-500">Your Role: <span className={`font-semibold text-red-600`}>{user?.role?.toUpperCase()}</span></p>
                
                <button type="submit" disabled={loading} className={`w-full ${DARK_CYAN_CLASS} text-white font-bold py-3 rounded-lg ${DARK_CYAN_HOVER_CLASS} transition shadow-md disabled:bg-gray-400`}>
                    {loading ? 'Saving...' : 'Update Admin Profile'}
                </button>
            </form>
        </div>
    );
};


const AdminWalletRequests = () => {
    const { token } = useAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updateStatus, setUpdateStatus] = useState(null);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/admin/wallet-requests`, { 
                headers: { 'x-auth-token': token },
            });
            
            if (!res.ok) {
                 const errorText = await res.json();
                 throw new Error(errorText.error || `Failed to fetch requests. Status: ${res.status}`);
            }
            
            const data = await res.json();
            setRequests(data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const handleAction = async (requestId, action) => {
        setUpdateStatus({ id: requestId, loading: true });
        setError('');
        
        try {
            const response = await fetch(`${API_BASE_URL}/admin/wallet-requests/${requestId}/${action}`, {
                method: 'PUT',
                headers: { 'x-auth-token': token },
            });
            
            if (!response.ok) {
                const errorText = await response.json();
                throw new Error(errorText.error || `${action} action failed.`);
            }
            
            await fetchRequests();
            setUpdateStatus({ id: requestId, success: true, message: `Request ${requestId} ${action} successfully.` });
            
        } catch (err) {
            setError(err.message || 'Network error during request update.');
        } finally {
            setUpdateStatus(null);
        }
    };
    
    const getStatusClasses = (status) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300 animate-pulse';
            case 'approved': return 'bg-green-100 text-green-800 border-green-300';
            case 'rejected': return 'bg-red-100 text-red-800 border-red-300';
            default: return 'bg-gray-100 text-gray-600 border-gray-300';
        }
    };


    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-700">Wallet Deposit/Withdrawal Requests</h2>
            <p className="text-gray-600">Review and approve customer deposit proofs and provider withdrawal requests.</p>
            
            {error && <ErrorMessage message={error}/>}
            {updateStatus && updateStatus.success && <SuccessMessage message={updateStatus.message} />}
            {loading && <Spinner />}
            
            <div className="space-y-4">
                {requests.length === 0 && !loading && <p className="text-center text-gray-500 bg-gray-100 p-10 rounded-xl shadow-inner">No active wallet requests at this time.</p>}
                
                {requests.map(req => {
                    const isProcessing = updateStatus && updateStatus.id === req.id && updateStatus.loading;
                    const isDeposit = req.type === 'deposit';
                    
                    return (
                        <div key={req.id} className="bg-white border border-gray-200 rounded-xl shadow-lg p-6 flex flex-col md:flex-row justify-between items-start md:items-center">
                            <div className="flex-grow space-y-2">
                                <div className="flex items-center space-x-3">
                                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border uppercase ${getStatusClasses(req.status)}`}>
                                        {req.status}
                                    </span>
                                    <span className="text-sm font-bold uppercase text-blue-600">{isDeposit ? 'Deposit' : 'Withdrawal'}</span>
                                    <p className="text-sm text-gray-500">Request ID: <span className="font-mono">{req.id}</span></p>
                                </div>
                                
                                <h3 className="text-xl font-bold text-slate-800">{CURRENCY_SYMBOL}{parseFloat(req.amount).toFixed(2)}</h3>
                                
                                <div className="text-gray-600 text-sm space-y-1">
                                    <p>📧 **User:** {req.email} ({req.role})</p>
                                    <p>📅 **Requested:** {new Date(req.requested_at).toLocaleString()}</p>
                                    
                                    {/* Deposit Specific Fields */}
                                    {isDeposit && (
                                        <>
                                            <p>💳 **Txn Ref:** <span className="font-mono text-cyan-700">{req.transaction_reference}</span></p>
                                            {req.screenshot_url && (
                                                <a href={req.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center">
                                                    View Payment Proof 🔗
                                                </a>
                                            )}
                                        </>
                                    )}
                                    {/* Withdrawal Specific Fields */}
                                    {!isDeposit && (
                                        <p>🏦 **Payout Details:** <span className="font-semibold text-red-700">{req.transaction_reference}</span></p>
                                    )}
                                </div>
                            </div>
                            
                            <div className="mt-4 md:mt-0 flex flex-col space-y-2 w-full md:w-auto">
                                {req.status === 'pending' ? (
                                    <>
                                        <button 
                                            onClick={() => handleAction(req.id, 'approve')} 
                                            disabled={isProcessing}
                                            className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition shadow-md disabled:bg-gray-400"
                                        >
                                            {isProcessing ? 'Processing...' : 'Approve & Update Wallet'}
                                        </button>
                                        <button 
                                            onClick={() => handleAction(req.id, 'reject')} 
                                            disabled={isProcessing}
                                            className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition shadow-md disabled:bg-gray-400"
                                        >
                                            Reject
                                        </button>
                                    </>
                                ) : (
                                    <p className={`font-bold text-sm text-center p-2 rounded-lg ${req.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                                        {req.status.toUpperCase()}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const AdminContactMessages = () => {
    const { token } = useAuth();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchMessages = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/admin/contact-messages`, { 
                headers: { 'x-auth-token': token },
            });
            
            if (!res.ok) {
                 const errorText = await res.json();
                 throw new Error(errorText.error || `Failed to fetch messages. Status: ${res.status}`);
            }
            
            const data = await res.json();
            setMessages(data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-700">Customer Contact Messages</h2>
            <p className="text-gray-600">All submissions from the Contact Us form.</p>
            
            {error && <ErrorMessage message={error}/>}
            {loading && <Spinner />}
            
            <div className="space-y-4">
                {messages.length === 0 && !loading && <p className="text-center text-gray-500 bg-gray-100 p-10 rounded-xl shadow-inner">No contact messages.</p>}
                
                {messages.map(msg => (
                    <div key={msg.id} className="bg-white border border-gray-200 rounded-xl shadow-lg p-6">
                        <div className="flex justify-between items-start border-b pb-2 mb-2">
                            <h3 className="text-lg font-semibold text-slate-800">{msg.sender_name}</h3>
                            <span className="text-xs text-gray-500">{new Date(msg.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm font-medium text-blue-600 mb-2">Email: {msg.sender_email}</p>
                        <p className="text-gray-700">{msg.message}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};


const AdminOverview = () => {
    const { token } = useAuth();
    const [metrics, setMetrics] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchMetrics = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/admin/overview-metrics`, { 
                headers: { 'x-auth-token': token },
            });
            
            if (!res.ok) {
                 const errorText = await res.json();
                 throw new Error(errorText.error || `Failed to fetch metrics. Status: ${res.status}`);
            }
            
            const data = await res.json();
            setMetrics(data || {});
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold mb-4 text-slate-700">Key Platform Metrics</h2>
            <p className="text-gray-600">Real-time counts for system health and pending actions.</p>
            
            {error && <ErrorMessage message={error} />}
            {loading && <Spinner />}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 pt-4">
                <div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg">
                    <p className="text-sm font-medium opacity-80">Total Users</p>
                    <h3 className="text-3xl font-extrabold mt-1">{metrics.total_users || '0'}</h3>
                </div>
                <div className="bg-green-600 text-white p-6 rounded-xl shadow-lg">
                    <p className="text-sm font-medium opacity-80">Total Bookings</p>
                    <h3 className="text-3xl font-extrabold mt-1">{metrics.total_bookings || '0'}</h3>
                </div>
                <div className="bg-yellow-600 text-white p-6 rounded-xl shadow-lg">
                    <p className="text-sm font-medium opacity-80">Pending Provider Verify</p>
                    <h3 className="text-3xl font-extrabold mt-1">{metrics.pending_verification || '0'}</h3>
                </div>
                {/* FIX: New metrics for Wallet Requests */}
                <div className="bg-red-600 text-white p-6 rounded-xl shadow-lg">
                    <p className="text-sm font-medium opacity-80">Pending Deposits</p>
                    <h3 className="text-3xl font-extrabold mt-1">{metrics.pending_deposits || '0'}</h3>
                </div>
                <div className="bg-red-600 text-white p-6 rounded-xl shadow-lg">
                    <p className="text-sm font-medium opacity-80">Pending Withdrawals</p>
                    <h3 className="text-3xl font-extrabold mt-1">{metrics.pending_withdrawals || '0'}</h3>
                </div>
            </div>
        </div>
    );
};


const AdminDashboard = () => {
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [users, setUsers] = useState([]);
    const [providers, setProviders] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const navItems = [
        { tab: 'overview', label: 'Overview' },
        { tab: 'walletRequests', label: 'Wallet Requests' }, 
        { tab: 'contactMessages', label: 'Contact Messages' }, // NEW TAB
        { tab: 'users', label: 'Manage Users' },
        { tab: 'providers', label: 'Provider Verification' },
        { tab: 'bookings', label: 'All Bookings' },
        { tab: 'profile', label: 'My Profile' },
    ];

    const fetchData = useCallback(async (endpoint, setter) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/admin/${endpoint}`, {
                headers: { 'x-auth-token': token },
            });
            if (!res.ok) {
                const errorText = await res.json();
                throw new Error(errorText.error || 'Failed to fetch admin data. Check authorization.');
            }
            const data = await res.json();
            setter(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token]);


    const handleVerify = async (providerId, currentStatus) => {
        setLoading(true);
        try {
            const newStatus = !currentStatus;
            const res = await fetch(`${API_BASE_URL}/admin/providers/${providerId}/verify`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-auth-token': token,
                },
                body: JSON.stringify({ is_verified: newStatus }),
            });
            
            if (!res.ok) {
                const errorText = await res.json();
                throw new Error(errorText.error || `Failed to ${newStatus ? 'verify' : 'un-verify'} provider.`);
            }
            
            await fetchData('providers', setProviders);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial data load for tables that don't change often
        if (token) {
            fetchData('users', setUsers);
            fetchData('providers', setProviders);
            fetchData('bookings', setBookings);
        }
    }, [token, fetchData]);

    // Refetch data specifically for the active tab (except Overview which handles its own fetch)
    useEffect(() => {
        if (token) {
            if (activeTab === 'users') fetchData('users', setUsers);
            else if (activeTab === 'providers') fetchData('providers', setProviders);
            else if (activeTab === 'bookings') fetchData('bookings', setBookings);
        }
    }, [activeTab, token, fetchData]);
    
    // Helper to render the table structure
    const AdminTable = ({ title, headers, data, actionHandler }) => (
        <div>
            <h2 className="text-2xl font-semibold text-slate-800 mb-4">{title}</h2>
            {loading && activeTab !== 'overview' && <Spinner />}
            {error && <ErrorMessage message={error} />}
            <div className="overflow-x-auto border rounded-xl shadow-sm">
                <table className="min-w-full bg-white">
                    <thead className="bg-blue-50">
                        <tr>
                            {headers.map(header => <th key={header} className="py-3 px-6 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b">{header}</th>)}
                        </tr>
                    </thead>
                    <tbody className="text-gray-700 text-sm font-light divide-y divide-gray-200">
                        {data.map((row, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                                {row.map((cell, cellIndex) => {
                                    if (headers[cellIndex] === 'Actions' && actionHandler) {
                                        const provider = providers.find(p => p.id === row[0]);
                                        return (
                                            <td key={cellIndex} className="py-3 px-6 text-left whitespace-nowrap">
                                                <button 
                                                    onClick={() => actionHandler(provider.id, provider.is_verified)} 
                                                    disabled={loading}
                                                    className={`px-3 py-1 text-xs rounded-lg font-bold shadow-sm transition ${provider.is_verified ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'bg-green-600 text-white hover:bg-green-700'} disabled:bg-gray-400`}
                                                >
                                                    {provider.is_verified ? 'Revoke' : 'Verify & Approve'}
                                                </button>
                                            </td>
                                        );
                                    }
                                    return <td key={cellIndex} className="py-3 px-6 text-left whitespace-nowrap">{cell}</td>;
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString();

    const userTableData = users.map(u => [
        u.id, 
        u.email, 
        <span key={u.id} className={`font-bold ${u.role === 'admin' ? 'text-red-500' : 'text-blue-500'}`}>{u.role.toUpperCase()}</span>,
        u.status,
        formatDate(u.created_at)
    ]);

    const providerTableData = providers.map(p => [
        p.id, 
        p.display_name, 
        p.services_offered || 'N/A',
        p.review_count,
        <span key={p.id} className={`font-bold ${p.is_verified ? 'text-green-600' : 'text-yellow-600'}`}>{p.is_verified ? 'Verified' : 'Pending'}</span>,
        p.id 
    ]);

    const bookingTableData = bookings.map(b => [
        b.id,
        b.provider_name,
        b.customer_email,
        formatDate(b.scheduled_at),
        <span key={b.id} className={`font-bold uppercase text-xs px-2 py-1 rounded-full ${
            b.booking_status === 'closed' ? 'bg-green-100 text-green-700' :
            b.booking_status.includes('pending') || b.booking_status.includes('awaiting') ? 'bg-yellow-100 text-yellow-700' :
            'bg-blue-100 text-blue-700'
        }`}>{b.booking_status.replace('_', ' ')}</span>,
        formatDate(b.created_at)
    ]);


    return (
        <DashboardLayout navItems={navItems} activeTab={activeTab} setActiveTab={setActiveTab} title="Platform Administration">
            {activeTab === 'overview' && <AdminOverview />}
            {activeTab === 'walletRequests' && <AdminWalletRequests />}
            {activeTab === 'contactMessages' && <AdminContactMessages />} 
            {activeTab === 'users' && <AdminTable title="All Users" headers={['ID', 'Email', 'Role', 'Status', 'Registered On']} data={userTableData} />}
            {activeTab === 'providers' && <AdminTable 
                title="Provider Verification Queue" 
                headers={['ID', 'Name', 'Services', 'Reviews', 'Status', 'Actions']} 
                data={providerTableData} 
                actionHandler={handleVerify} 
            />}
            {activeTab === 'bookings' && <AdminTable title="All Platform Bookings" headers={['ID', 'Provider', 'Customer Email', 'Scheduled', 'Status', 'Created On']} data={bookingTableData} />}
            {activeTab === 'profile' && <AdminProfileManagement />}
        </DashboardLayout>
    );
};


// --- GENERAL LAYOUT AND CORE APP ---

const DashboardLayout = ({ children, navItems, activeTab, setActiveTab, title }) => {
    const { user } = useAuth();
    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="container mx-auto px-6 py-10">
                <h1 className="text-3xl font-extrabold text-slate-800 mb-2">{title}</h1>
                <p className="text-gray-500 mb-8">Logged in as: <span className="font-medium text-slate-700">{user?.email || 'N/A'} ({user?.role})</span></p>
                <div className="flex flex-col md:flex-row gap-8">
                    <aside className="md:w-1/4">
                        <nav className="bg-white rounded-xl shadow-lg p-4 border border-gray-200 sticky top-24">
                            <ul>
                               {navItems.map(item => (
                                    <li key={item.tab} className="mb-1">
                                         <a
                                             onClick={() => setActiveTab(item.tab)}
                                             className={`block px-4 py-3 rounded-lg cursor-pointer transition-colors text-lg ${activeTab === item.tab ? `${DARK_CYAN_CLASS} text-white font-bold shadow-md` : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-700'}`}
                                         >
                                             {item.label}
                                         </a>
                                     </li>
                                ))}
                            </ul>
                        </nav>
                    </aside>
                    <main className="md:w-3/4">
                        <div className="bg-white rounded-xl shadow-lg p-6 min-h-[500px] border border-gray-200">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};
const HomePage = ({ setPage, setSelectedService, setSearchParams,setSelectedProvider }) => {
  const [services, setServices] = useState([]);
  const [topProviders, setTopProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const { user, isAuthenticated } = useAuth(); // Import useAuth to get user location

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Services
        const servicesRes = await fetch(`${API_BASE_URL}/services`);
        if (!servicesRes.ok) throw new Error("Failed to fetch services.");
        const servicesData = await servicesRes.json();
        setServices(servicesData);

        // 2. Fetch Top Rated Providers
        // Use user's current location if available, otherwise mock 0, 0
        const defaultLat = isAuthenticated ? getProfileField(user, 'location_lat', 0) : 0;
        const defaultLon = isAuthenticated ? getProfileField(user, 'location_lon', 0) : 0;
        
        const providersRes = await fetch(
          `${API_BASE_URL}/providers?lat=${defaultLat}&lon=${defaultLon}&sort_by=top_rated` // Removed specific service ID for broad top rating
        );
        if (!providersRes.ok) console.warn("Failed to fetch top providers.");
        const providersData = await providersRes.json();
        setTopProviders(providersData.providers || []);
        
        // 3. Initialize search location if user has saved one
        const userLat = getProfileField(user, 'location_lat', 0);
        const userLon = getProfileField(user, 'location_lon', 0);
        if (isAuthenticated && userLat !== 0 && userLon !== 0) {
            setSearchLocation(`${userLat}, ${userLon}`);
        }

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isAuthenticated, user]);

  const handleServiceClick = (service) => {
    setSelectedService(service);
    setPage("serviceProviders");
  };

  const handleSearch = () => {
    const [lat, lon] = searchLocation.split(",").map((s) => s.trim());
    setSearchParams({
      query: searchQuery,
      lat: parseFloat(lat) || null,
      lon: parseFloat(lon) || null,
    });
    setPage("allServices");
  };

  const handleProviderClick = (provider) => {
    // Determine which service to show (using the one returned by the backend query for simplicity)
    const service = services.find(s => s.id === provider.service_id) || services[0];
    setSelectedService(service);
    setSelectedProvider(provider);
    setPage("providerDetail");
  };

  return (
    <main>
      {/* HERO SECTION */}
      <section className={`${DARK_CYAN_CLASS} pt-0 pb-40 relative overflow-hidden`}>
        {/* Full-width Background Image */}
        <div className="absolute inset-0 w-full h-[500px]">
          <img
            src="https://placehold.co/1200x500/008080/ffffff?text=Service+Connect+Hero"
            alt="Trusted experts team graphic"
            className="w-full h-full object-cover object-center"
          />
          {/* Overlay for better contrast */}
          <div className="absolute inset-0 bg-black/40"></div>
        </div>

        {/* Text & Search Overlay */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center pt-32 px-6">
          {/* Transparent Gradient Heading */}
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-blue-500 drop-shadow-md mb-10 whitespace-nowrap">
            Your trusted experts at your doorstep
          </h1>

          {/* Search Bar */}
          <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-lg flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-2 max-w-3xl w-full">
            {/* Service Input */}
            <input
              type="text"
              placeholder="What service are you looking for?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-grow p-3 rounded-lg text-base focus:outline-none border border-gray-200 focus:ring-2 focus:ring-blue-400 transition-all duration-200"
            />
            {/* Location Input */}
            <div className="relative flex items-center w-full md:w-auto">
              <span className="absolute left-3 text-gray-400">📍</span>
              <input
                type="text"
                placeholder="Your Location (e.g., Lat, Lon)"
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                className="pl-8 p-3 rounded-lg text-base w-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200"
              />
            </div>
            {/* Search Button */}
            <button
              onClick={handleSearch}
              className={`${DARK_CYAN_CLASS} text-white font-bold px-6 py-3 rounded-xl ${DARK_CYAN_HOVER_CLASS} transition-all duration-200 w-full md:w-auto text-base shadow-md`}
            >
              Search
            </button>
          </div>
        </div>
      </section>

      {/* FIX: POPULAR SERVICES SECTION (Moved to top of content) */}
      <section className="py-16 -mt-32 relative z-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-2xl font-extrabold text-slate-800 mb-8 border-b pb-2">
            Popular Services
          </h2>

          {loading && <Spinner />}
          {error && <ErrorMessage message={error} />}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {(services || []).slice(0, 6).map((service, index) => (
              <ServiceCard
                key={service.id}
                service={{
                  ...service,
                  icon:
                    index === 0
                      ? "🔧"
                      : index === 1
                      ? "💡"
                      : index === 2
                      ? "🔨"
                      : "🛠️",
                }}
                onClick={handleServiceClick}
              />
            ))}
          </div>
        </div>
      </section>
      
      {/* FIX: TOP RATED PROVIDERS SECTION (Moved after Popular Services) */}
      <section className="py-16 relative z-20 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-2xl font-extrabold text-slate-800 mb-8 border-b pb-2">
            Top Rated Professionals
          </h2>
          {loading && <Spinner />}
          {error && <ErrorMessage message={error} />}

          <div className="flex overflow-x-auto space-x-6 pb-4">
            {topProviders.length > 0 ? (
              topProviders.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  onClick={() => handleProviderClick(provider)}
                />
              ))
            ) : (
              !loading && (
                <p className="text-gray-500">
                  No top-rated providers found yet. Be the first to review!
                </p>
              )
            )}
          </div>
        </div>
      </section>

      {/* FIX: HOW IT WORKS SECTION (Moved to last) */}
      <section className="py-16 relative z-20 bg-gray-50">
         <div className="container mx-auto px-6">
            <h2 className="text-2xl font-extrabold text-slate-800 mb-8 mt-4 border-b pb-2">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <HowItWorksCard
              icon="🔍"
              title="1. Search & Book"
              description="Find trusted professionals in your service area based on ratings."
            />
            <HowItWorksCard
              icon="📅"
              title="2. Service at Doorstep"
              description="Schedule a visit at your convenience and track arrival."
            />
            <HowItWorksCard
              icon="💳"
              title="3. Pay & Review"
              description="Secure payment and share feedback to build trust."
              stars="⭐⭐⭐⭐⭐"
            />
          </div>
         </div>
      </section>
    </main>
  );
};


const AllServicesPage = ({ setPage, setSelectedService, searchParams }) => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchServices = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/services`);
                if (!res.ok) throw new Error('Failed to fetch services. Is the backend running?');
                let data = await res.json();
                
                // Mock filtering by query (since backend only filters by service ID)
                if (searchParams?.query) {
                    const query = searchParams.query.toLowerCase();
                    data = data.filter(s => s.name.toLowerCase().includes(query) || s.description.toLowerCase().includes(query));
                }
                
                setServices(data || []);
            } catch (err) {
                setError(err.message || 'Failed to load services.');
            } finally {
                setLoading(false);
            }
        };
        fetchServices();
    }, [searchParams]);

    const handleServiceClick = (service) => {
        setSelectedService(service);
        setPage('serviceProviders');
    };
    
    return (
        <div className="container mx-auto px-6 py-16">
            {/* FIX: Back link needs to use navigate function */}
            <a onClick={() => setPage('home')} className="text-blue-600 hover:text-blue-800 font-medium transition mb-8 flex items-center cursor-pointer">&larr; Back to Home</a>
            <h1 className="text-4xl font-bold text-slate-800 mb-4 text-center border-b pb-4">All Available Services</h1>
             {searchParams?.query && (
                 <p className="text-center text-lg text-gray-600 mb-8">Showing results for: **"{searchParams.query}"**</p>
             )}
            {loading && <Spinner />}
            {error && <ErrorMessage message={error} />}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 mt-6">
                {(services || []).map(service => (
                    <ServiceCard key={service.id} service={service} onClick={handleServiceClick} />
                ))}
            </div>
        </div>
    );
};
const ServiceProvidersPage = ({ service, setPage, setSelectedProvider }) => {
    const { user, isAuthenticated } = useAuth();
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Get customer default location from profile
    const lat = isAuthenticated ? getProfileField(user, 'location_lat', null) : null;
    const lon = isAuthenticated ? getProfileField(user, 'location_lon', null) : null;
    
    const locationMessage = lat && lon ? `Searching within your default location: (${lat}, ${lon})` : 'Using mock location (0, 0). Please update your profile.';

    useEffect(() => {
        if (!service || !service.id) {
            setError('No service selected. Returning to service list.');
            setTimeout(() => setPage('allServices'), 2000);
            setLoading(false);
            return;
        }

        const fetchProviders = async () => {
            // Use mock coordinates if user is not authenticated or coordinates are missing
            const searchLat = lat || 0; 
            const searchLon = lon || 0; 
            
            try {
                // Modified endpoint to include lat/lon for distance filtering on backend
                const res = await fetch(`${API_BASE_URL}/providers?service_id=${service.id}&lat=${searchLat}&lon=${searchLon}`);
                if (!res.ok) throw new Error('Failed to fetch providers');
                const data = await res.json();
                setProviders(data.providers || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchProviders();
    }, [service, setPage, lat, lon, isAuthenticated]);


    const handleProviderClick = (provider) => {
        setSelectedProvider(provider);
        setPage('providerDetail');
    };

    return (
        <div className="container mx-auto px-6 py-16">
            {/* FIX: Back link now navigates to 'allServices' */}
            <a onClick={() => setPage('allServices')} className="text-blue-600 hover:text-blue-800 font-medium transition mb-8 flex items-center cursor-pointer">&larr; Back to Services</a>
            <h1 className="text-4xl font-extrabold text-slate-800 mb-2">{service?.name || "Service Providers"}</h1>
            <p className="text-lg text-gray-600 mb-4 max-w-3xl">{service?.description}</p>
            <p className="text-sm text-blue-500 font-medium mb-8">{locationMessage}</p>
            
            {loading && <Spinner />}
            {error && <ErrorMessage message={error} />}
            <div className="space-y-6">
                {!loading && providers.length > 0 ? (
                    providers.map(provider => (
                        <ProviderCard key={provider.id} provider={provider} onClick={handleProviderClick} />
                    ))
                ) : (
                    !loading && !error && <p className="text-center text-gray-500 bg-gray-100 p-10 rounded-xl shadow-inner">
                        No verified providers found for this service near your location.
                    </p>
                )}
            </div>
        </div>
    );
};
const ProviderDetailPage = ({ provider, service, setPage }) => {
    const { isAuthenticated, user } = useAuth();
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

    const mockServiceName = service?.name || 'Service Professional';

    if (!provider) return <ErrorMessage message="No provider selected." />;
    
    // const portfolio = [ /* ... removed for brevity */ ];

    const handleRequestService = () => {
        if (!isAuthenticated || user?.role !== 'customer') {
            console.log("[UI Notification] Please log in as a customer to request a service.");
            setPage('login');
        } else {
            setIsBookingModalOpen(true);
        }
    };
    
    const handleBookingSuccess = () => {
        setIsBookingModalOpen(false);
        setPage('customerDashboard');
    };
    
    return (
        <div className="container mx-auto px-6 py-16">
            <button onClick={() => setPage('serviceProviders')} className="text-blue-600 hover:text-blue-800 font-medium transition mb-8 flex items-center">&larr; Back to Providers</button>
            
            <div className="bg-white rounded-xl shadow-2xl p-6 lg:p-10 border border-gray-200">
                
                {/* Header Section */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b pb-6 mb-6">
                    <div className="flex items-center space-x-6">
                        <img className="w-32 h-32 rounded-full object-cover shadow-xl border-4 border-white ring-2 ring-cyan-500" 
                            src={provider.profile_picture_url || `https://placehold.co/150x150/E0E7FF/4338CA?text=${provider.display_name.charAt(0)}`} 
                            alt={provider.display_name} 
                        />
                        <div>
                            <h1 className="text-3xl font-extrabold text-slate-800">{provider.display_name}</h1>
                            <p className={`text-lg ${DARK_CYAN_TEXT_CLASS} font-semibold mb-2`}>{mockServiceName}</p>
                            <div className="flex items-center space-x-2">
                                <span className="bg-amber-100 text-amber-600 text-sm font-bold px-3 py-1 rounded-full flex items-center">
                                    <span className="text-lg mr-1">⭐</span>{parseFloat(provider.average_rating || 0).toFixed(1)}
                                </span>
                                <span className="text-gray-500 text-sm">({provider.review_count || 0} reviews)</span>
                                {provider.is_verified && <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">✔️ Verified</span>}
                            </div>
                        </div>
                    </div>

                    {/* CTA Button */}
                    <button 
                        onClick={handleRequestService}
                        className={`mt-6 lg:mt-0 ${DARK_CYAN_CLASS} text-white text-lg font-bold px-8 py-3 rounded-lg ${DARK_CYAN_HOVER_CLASS} transition shadow-lg`}
                        disabled={user?.role === 'provider' || user?.role === 'admin'}
                    >
                        Request Service
                    </button>
                </div>
                
                {/* Details and Info */}
                <div className="grid md:grid-cols-3 gap-8 mb-10">
                    <div className="md:col-span-2">
                        <h2 className="text-2xl font-bold text-slate-700 mb-4 border-b pb-2">About the Professional</h2>
                        <p className="text-gray-700 leading-relaxed mb-4">{provider.bio || "This professional has not yet provided a detailed biography."}</p>
                        
                        <h3 className="text-xl font-bold text-slate-700 mb-3">Service Details</h3>
                        <ul className="list-disc list-inside text-gray-700 space-y-2">
                            <li><span className="font-semibold">Primary Service:</span> {mockServiceName}</li>
                            <li><span className="font-semibold">Service Area:</span> {provider.service_radius_km || 10} km radius from location ({provider.location_lat}, {provider.location_lon})</li>
                            <li><span className="font-semibold">Avg Rate:</span> {CURRENCY_SYMBOL}400/hr (Estimated)</li>
                        </ul>
                    </div>
                </div>
            </div>
            {isBookingModalOpen && service && (
                <BookingModal 
                    provider={provider} 
                    service={service} 
                    onClose={() => setIsBookingModalOpen(false)} 
                    onBooked={handleBookingSuccess}
                    navigate={setPage}
                />
            )}
        </div>
    );
};
// App.js - AboutPage Component (Enhancement)
const AboutPage = () => {
    return (
        <div className="bg-white">
            <div className="container mx-auto px-6 py-20">
                <div className="text-center">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4">About Service Connect</h1>
                    <p className="text-xl text-gray-600 max-w-4xl mx-auto">
                        Connecting communities with reliable local professionals. Our mission is to build trust in local services by ensuring quality, transparency, and accountability between customers and service providers.
                    </p>
                </div>

                <div className="mt-16 max-w-5xl mx-auto">
                    <h2 className="text-3xl font-bold text-slate-800 mb-6 border-b pb-2">How Service Connect Works</h2>
                    <div className="grid md:grid-cols-3 gap-8 text-left">
                        <div className="space-y-3 p-4 border rounded-xl shadow-sm">
                            <h3 className="text-xl font-semibold text-blue-600">1. Search & Book</h3>
                            <p className="text-gray-700">Customers easily find trusted local professionals by searching service categories and filtering results based on location, service radius, and ratings.</p>
                        </div>
                        <div className="space-y-3 p-4 border rounded-xl shadow-sm">
                            <h3 className="text-xl font-semibold text-blue-600">2. Quote & Acceptance</h3>
                            <p className="text-gray-700">After a booking request, the provider sends a quoted price. The customer must explicitly accept this price before the service is officially accepted and scheduled.</p>
                        </div>
                        <div className="space-y-3 p-4 border rounded-xl shadow-sm">
                            <h3 className="text-xl font-semibold text-blue-600">3. Pay & Review</h3>
                            <p className="text-gray-700">Once the service is completed, the customer pays the quoted price securely via the in-app wallet and leaves a verified review, directly impacting the provider's rating.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
// App.js - ContactPage Component (Enhancement)
const ContactPage = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // Mock details (based on .env context)
    const SUPPORT_EMAIL = 'support@serviceconnect.com'; // Placeholder, assuming a support email
    const PHONE_NUMBER = '+91 80 1234 5678'; // Placeholder
    const ADDRESS = '101 Tech Park, Bangalore, India'; // Placeholder
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        
        const data = {
            name: e.target.name.value,
            email: e.target.email.value,
            problem_description: e.target.problem_description.value,
        };

        try {
            const response = await fetch(`${API_BASE_URL}/contact-us`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            
            const result = await response.json();
            
            if (response.ok) {
                setSuccess(result.message);
                e.target.reset();
            } else {
                setError(result.error || 'Failed to submit message.');
            }
        } catch (err) {
            setError('Network error occurred during submission.');
        } finally {
            setLoading(false);
        }
    };


    return (
         <div className="container mx-auto px-6 py-16">
            <h1 className="text-4xl font-bold text-slate-800 mb-10 text-center border-b pb-4">Get in Touch</h1>
            
            <div className="grid md:grid-cols-3 gap-10">
                
                {/* Left/Main Section: Query Form */}
                <div className="md:col-span-2 bg-white p-8 rounded-xl shadow-lg border">
                    <h2 className="text-2xl font-semibold mb-4 text-slate-700">Send Us a Message</h2>
                    <p className="text-gray-600 mb-6">If you have any queries, suggestions, or specific problems (customer or provider), please use the form below.</p>
                    
                    {error && <ErrorMessage message={error} />}
                    {success && <SuccessMessage message={success} />}
                    
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="name" className="block text-sm font-semibold text-gray-700">Your Name</label>
                            <input type="text" id="name" name="name" required className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg" />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-semibold text-gray-700">Your Email Address (For Admin Reply)</label>
                            <input type="email" id="email" name="email" required className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg" />
                        </div>
                        {/* Description Box for Problems/Queries */}
                        <div>
                            <label htmlFor="problem_description" className="block text-sm font-semibold text-gray-700">
                                Description of Query / Problem (e.g., Customer problem, Provider issue, Suggestion)
                            </label>
                            <textarea id="problem_description" name="problem_description" rows="5" required 
                                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg" 
                                placeholder="Describe the issue. If it's a customer/provider problem, specify the user's name/email/ID if known."
                            ></textarea>
                        </div>
                        <button type="submit" disabled={loading} className={`w-full ${DARK_CYAN_CLASS} text-white font-bold py-3 rounded-lg ${DARK_CYAN_HOVER_CLASS} transition disabled:bg-gray-400`}>
                            {loading ? 'Submitting...' : 'Submit to Admin'}
                        </button>
                    </form>
                </div>
                
                {/* Right Section: Contact Info Sidebar */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-lg border">
                        <h3 className="text-xl font-semibold mb-4 text-slate-700">Direct Contact</h3>
                        <div className="space-y-3">
                            <p className="flex items-center text-gray-700"><span className="text-xl mr-3 text-blue-600">📧</span> <strong>Email:</strong> <a href={`mailto:${SUPPORT_EMAIL}`} className="ml-2 text-blue-600 hover:underline">{SUPPORT_EMAIL}</a></p>
                            <p className="flex items-center text-gray-700"><span className="text-xl mr-3 text-green-600">📞</span> <strong>Phone:</strong> <a href={`tel:${PHONE_NUMBER}`} className="ml-2 text-blue-600 hover:underline">{PHONE_NUMBER}</a></p>
                            <p className="flex items-center text-gray-700"><span className="text-xl mr-3 text-red-600">📍</span> <strong>Address:</strong> <span className="ml-2">{ADDRESS}</span></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
const AuthFormContainer = ({ children, title }) => (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <h2 className="mt-6 text-center text-4xl font-extrabold text-slate-900">{title}</h2>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-4 shadow-2xl rounded-xl sm:px-10 border border-gray-200">
                {children}
            </div>
        </div>
    </div>
);
const LoginPage = ({ setPage }) => {
    const { login } = useAuth();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const email = e.target.email.value;
        const password = e.target.password.value;
        const result = await login(email, password);
        setLoading(false);
        if (result.success) {
             if (result.role === 'admin') setPage('adminDashboard');
             else if (result.role === 'provider') setPage('providerDashboard');
             else setPage('customerDashboard');
        } else {
            setError(result.message || 'Invalid credentials.');
        }
    };
    
    return (
        <AuthFormContainer title="Sign in to Service Connect">
            <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700">Email address</label>
                    <input id="email" name="email" type="email" required className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition"/>
                </div>
                <div>
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700">Password</label>
                    <input id="password" name="password" type="password" required className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition"/>
                </div>
                {error && <ErrorMessage message={error}/>}
                <div className="text-sm text-right">
                    <a onClick={() => setPage('forgotPassword')} className="font-medium text-blue-600 hover:text-blue-700 cursor-pointer transition">Forgot your password?</a>
                </div>
                <button type="submit" disabled={loading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:bg-gray-400">
                    {loading ? 'Signing in...' : 'Sign in'}
                </button>
            </form>
            <div className="mt-6 text-center text-sm">
                Don't have an account? <a onClick={() => setPage('register')} className="font-medium text-blue-600 hover:text-blue-700 cursor-pointer transition">Register here</a>
            </div>
        </AuthFormContainer>
    );
};
const RegisterPage = ({ setPage }) => {
    const { register } = useAuth();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [services, setServices] = useState([]);
    const [role, setRole] = useState('customer');
    const [primaryService, setPrimaryService] = useState('');
    const [isRegistered, setIsRegistered] = useState(false);
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regRole, setRegRole] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchServices = async () => {
            const res = await fetch(`${API_BASE_URL}/services`);
            const data = await res.json();
            if (data && data.length > 0) {
              setServices(data || []);
              setPrimaryService(data[0].id);
            }
        };
        fetchServices();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess(''); setLoading(true);
        const email = e.target.email.value;
        const password = e.target.password.value;
        
        const result = await register(email, password, role);
        setLoading(false);
        if (result.success) {
            setSuccess(result.message);
            setRegEmail(email);
            setRegPassword(password);
            setRegRole(role);
            setIsRegistered(true);
        } else {
            setError(result.message || "Registration failed.");
        }
    };
    
    // Switch to OTP verification page if registration initiated
    if (isRegistered) {
        // FIX: Passing primaryServiceId to the OTP page
        return <RegisterOtpPage email={regEmail} password={regPassword} role={regRole} primaryServiceId={primaryService} setPage={setPage} />;
    }

    return (
        <AuthFormContainer title="Create an account">
             <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="role" className="block text-sm font-semibold text-gray-700">I am a...</label>
                    <select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value)} required 
                        className="mt-1 block w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition">
                        <option value="customer">Customer (Looking for services)</option>
                        <option value="provider">Service Provider (Offering services)</option>
                        {/* Admin role is hidden from public registration */}
                    </select>
                </div>
                {role === 'provider' && services.length > 0 && (
                     <div>
                        <label htmlFor="service" className="block text-sm font-semibold text-gray-700">Primary Service Category</label>
                        <select id="service" name="service" value={primaryService} onChange={e => setPrimaryService(e.target.value)} required 
                            className="mt-1 block w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition">
                            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                )}
                <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700">Email address</label>
                    <input id="email" name="email" type="email" required className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition"/>
                </div>
                <div>
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700">Password</label>
                    <input id="password" name="password" type="password" required className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition"/>
                </div>
                {error && <ErrorMessage message={error}/>}
                {success && <SuccessMessage message={success}/>}
                <button type="submit" disabled={loading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:bg-gray-400">
                    {loading ? 'Creating Account...' : 'Create Account'}
                </button>
            </form>
            <div className="mt-6 text-center text-sm">
                Already have an account? <a onClick={() => setPage('login')} className="font-medium text-blue-600 hover:text-blue-700 cursor-pointer transition">Sign in</a>
            </div>
        </AuthFormContainer>
    );
};
const RegisterOtpPage = ({ email, password, role, primaryServiceId, setPage }) => {
    const { verifyOtp, login } = useAuth();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    
    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess(''); setLoading(true);
        const otp = e.target.otp.value;
        
        const result = await verifyOtp(email, otp);
        setLoading(false);
        
        if (result.success) {
            setSuccess('Verification successful! Logging you in...');
            
            // Log in the now-verified user
            const loginResult = await login(email, password); 
            
            if (loginResult.success) {
                if (role === 'provider') {
                    // FIX: Pass primaryServiceId to providerSetup
                    setPage('providerSetup', { primaryServiceId: primaryServiceId });
                } else {
                    setPage('customerDashboard');
                }
            } else {
                // If login fails, redirect to login page
                setPage('login'); 
            }
        } else {
            setError(result.message || 'Invalid or expired OTP.');
        }
    };
    
    return (
        <AuthFormContainer title="Verify Your Email">
            <p className="text-center text-sm text-gray-600 mb-6">A 6-digit code has been sent to <span className="font-semibold text-slate-800">{email}</span>. Check your inbox.</p>
            <form className="space-y-6" onSubmit={handleOtpSubmit}>
                <div>
                    <label htmlFor="otp" className="block text-sm font-semibold text-gray-700">6-Digit OTP</label>
                    <input id="otp" name="otp" type="text" maxLength="6" required className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition"/>
                </div>
                 
                {success && <SuccessMessage message={success}/>}
                {error && <ErrorMessage message={error}/>}
                <button type="submit" disabled={loading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:bg-gray-400">
                    {loading ? 'Verifying...' : 'Verify Account'}
                </button>
            </form>
             <div className="mt-6 text-center text-sm">
                Wrong email? <a onClick={() => setPage('register')} className="font-medium text-blue-600 hover:text-blue-700 cursor-pointer transition">Go back and re-register</a>
            </div>
        </AuthFormContainer>
    );
};
const ForgotPasswordPage = ({ setPage }) => {
    const { sendOtp, resetPassword } = useAuth();
    const [step, setStep] = useState(1);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setError(''); setMessage(''); setLoading(true);
        const submittedEmail = e.target.email.value;
        setEmail(submittedEmail);
        
        const result = await sendOtp(submittedEmail); 
        setLoading(false);
        
        if(result.success) {
            setMessage(result.message);
            setStep(2);
        } else {
            setError(result.message || 'Failed to send OTP.');
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setError(''); setMessage(''); setLoading(true);
        const otp = e.target.otp.value;
        const newPassword = e.target.newPassword.value;

        const result = await resetPassword(email, otp, newPassword);
        setLoading(false);
        
        if (result.success) {
            setMessage('Your password has been successfully reset. Redirecting to login...');
            setTimeout(() => setPage('login'), 2000);
        } else {
            setError(result.message || 'Invalid code or password.');
        }
    };
    
    if (step === 2) {
        return (
            <AuthFormContainer title="Reset Your Password">
                <p className="text-center text-sm text-gray-600 mb-6">A 6-digit code has been sent to <span className="font-semibold text-slate-800">{email}</span>.</p>
                <form className="space-y-6" onSubmit={handleOtpSubmit}>
                     <div>
                        <label htmlFor="otp" className="block text-sm font-semibold text-gray-700">6-Digit OTP</label>
                        <input id="otp" name="otp" type="text" maxLength="6" required className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition"/>
                    </div>
                     <div>
                        <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-700">New Password</label>
                        <input id="newPassword" name="newPassword" type="password" required className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition"/>
                    </div>
                    {message && <SuccessMessage message={message}/>}
                    {error && <ErrorMessage message={error}/>}
                    <button type="submit" disabled={loading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:bg-gray-400">
                        {loading ? 'Processing...' : 'Reset Password'}
                    </button>
                </form>
            </AuthFormContainer>
        );
    }

    return (
        <AuthFormContainer title="Forgot Password">
            <p className="text-center text-sm text-gray-600 mb-6">Enter your account's email address to receive a password reset code.</p>
            <form className="space-y-6" onSubmit={handleEmailSubmit}>
                <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700">Email address</label>
                    <input id="email" name="email" type="email" required className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition"/>
                </div>
                {message && <SuccessMessage message={message} />}
                {error && <ErrorMessage message={error} />}
                <button type="submit" disabled={loading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:bg-gray-400">
                    {loading ? 'Sending...' : 'Send Reset Code'}
                </button>
            </form>
            <div className="mt-6 text-center text-sm">
                Remember your password? <a onClick={() => setPage('login')} className="font-medium text-blue-600 hover:text-blue-700 cursor-pointer transition">Sign in</a>
            </div>
        </AuthFormContainer>
    );
};
const ProviderSetupPage = ({ setPage, pageData }) => {
    const { token } = useAuth();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess(''); setLoading(true);

        // FIX: Retrieving primaryServiceId from pageData
        if (!pageData || !pageData.primaryServiceId) {
             setError('Primary service ID is missing. Please re-register.');
             setLoading(false);
             return;
        }

        const profileData = {
            display_name: e.target.display_name.value,
            bio: e.target.bio.value,
            location_lat: parseFloat(e.target.lat.value), 
            location_lon: parseFloat(e.target.lon.value),
            service_radius_km: parseInt(e.target.radius.value, 10),
            service_ids: [pageData.primaryServiceId],
            payout_upi_id: e.target.payout_upi_id.value
        };

        try {
            const response = await fetch(`${API_BASE_URL}/provider/profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token,
                },
                body: JSON.stringify(profileData),
            });
            const data = await response.json();
            setLoading(false);
            if (response.ok) {
                setSuccess('Profile setup complete! Redirecting to your dashboard...');
                setTimeout(() => setPage('providerDashboard'), 2000);
            } else {
                setError(data.error || 'Failed to set up profile. Check if you already have a profile.');
            }
        } catch (err) {
            setLoading(false);
            setError('A network error occurred.');
        }
    };

    return (
        <AuthFormContainer title="Set Up Your Provider Profile">
            <p className="text-center text-sm text-gray-600 mb-6">Complete these details to make your profile visible to customers.</p>
            <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="display_name" className="block text-sm font-semibold text-gray-700">Display Name (e.g., Rajesh Sharma, R.S. Electric)</label>
                    <input id="display_name" name="display_name" type="text" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" />
                </div>
                <div>
                    <label htmlFor="bio" className="block text-sm font-semibold text-gray-700">Short Bio / Expertise Summary</label>
                    <textarea id="bio" name="bio" rows="3" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" placeholder="Describe your services and experience (Max 250 chars)..."></textarea>
                </div>
                <h3 className="text-lg font-bold text-slate-700 border-b pb-2">Service Location</h3>
                <div className="grid grid-cols-3 gap-4">
                     <div>
                        <label htmlFor="lat" className="block text-sm font-semibold text-gray-700">Location Latitude</label>
                        <input id="lat" name="lat" type="number" step="any" defaultValue="12.9716" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" />
                    </div>
                     <div>
                        <label htmlFor="lon" className="block text-sm font-semibold text-gray-700">Location Longitude</label>
                        <input id="lon" name="lon" type="number" step="any" defaultValue="77.5946" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" />
                    </div>
                     <div>
                        <label htmlFor="radius" className="block text-sm font-semibold text-gray-700">Service Radius (km)</label>
                        <input id="radius" name="radius" type="number" defaultValue="10" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" />
                    </div>
                </div>
                <h3 className="text-lg font-bold text-slate-700 border-b pb-2">Payout Details</h3>
                <div>
                    <label htmlFor="payout_upi_id" className="block text-sm font-semibold text-gray-700">Primary Payout UPI ID / Bank Details</label>
                    <input id="payout_upi_id" name="payout_upi_id" type="text" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" placeholder="E.g., yourname@bank or A/C: 1234"/>
                </div>
                {error && <ErrorMessage message={error}/>}
                {success && <SuccessMessage message={success}/>}
                <button type="submit" disabled={loading} className="w-full flex justify-center py-3 px-4 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md disabled:bg-gray-400">
                    {loading ? 'Saving Profile...' : 'Complete Setup & Go Live'}
                </button>
            </form>
        </AuthFormContainer>
    );
};

const AppContent = () => {
    const [page, setPage] = useState('home');
    const [pageData, setPageData] = useState(null);
    const [selectedService, setSelectedService] = useState(null);
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [searchParams, setSearchParams] = useState(null); 
    
    // Now safe to call inside the Provider context
    const { loading: authLoading } = useAuth(); 

    const navigate = (pageName, data = null) => {
        setPageData(data);
        setPage(pageName);
        window.scrollTo(0, 0); 
    };

    const renderPage = () => {
        if (authLoading) {
            return (
                <div className="flex justify-center items-center h-screen w-full bg-gray-50">
                    <Spinner />
                    <p className="ml-4 text-xl font-semibold text-slate-700">Loading Application...</p>
                </div>
            );
        }

        switch (page) {
            case 'home': return <HomePage setPage={navigate} setSelectedService={setSelectedService} setSearchParams={setSearchParams} />;
            case 'allServices': return <AllServicesPage setPage={navigate} setSelectedService={setSelectedService} searchParams={searchParams} />;
            case 'serviceProviders': return <ServiceProvidersPage service={selectedService} setPage={navigate} setSelectedProvider={setSelectedProvider} />;
            case 'providerDetail': return <ProviderDetailPage provider={selectedProvider} service={selectedService} setPage={navigate} />; 
            case 'about': return <AboutPage />;
            case 'contact': return <ContactPage />;
            case 'login': return <LoginPage setPage={navigate} />;
            case 'register': return <RegisterPage setPage={navigate} />;
            case 'forgotPassword': return <ForgotPasswordPage setPage={navigate} />; 
            case 'providerSetup': return <ProviderSetupPage setPage={navigate} pageData={pageData} />;
            case 'customerDashboard': return <CustomerDashboard setPage={navigate} />; 
            case 'providerDashboard': return <ProviderDashboard />;
            case 'adminDashboard': return <AdminDashboard />;
            default: return <HomePage setPage={navigate} setSelectedService={setSelectedService} setSearchParams={setSearchParams} />;
        }
    };
    
    return (
        <div className="flex flex-col min-h-screen font-sans bg-gray-50">
            <Header setPage={navigate} />
            <main className="flex-grow">
                {renderPage()}
            </main>
            <Footer setPage={navigate} />
        </div>
    );
};

export default function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}
