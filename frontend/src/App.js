import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

// --- API Configuration ---
const API_BASE_URL = 'http://localhost:3001/api/v1';

// --- UTILITY FUNCTIONS ---
// Helper to safely read nested user profile data
const getProfileField = (user, field, defaultValue = '') => user?.profile?.[field] || defaultValue;

// --- AUTH CONTEXT ---

const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

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
                // The backend now returns user_profile which includes nested 'profile' data
                setUser(data.user_profile);
            } else {
                logout(); // Token is invalid or expired
            }
        } catch (error) {
            console.error("Failed to fetch user profile:", error);
            logout();
        } finally {
            setLoading(false);
        }
    }, [logout]);

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        fetchUserProfile(storedToken);
    }, [fetchUserProfile]);

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

    const value = { user, token, login, logout, register, loading, isAuthenticated: !!user, fetchUserProfile, sendOtp, resetPassword };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

const useAuth = () => useContext(AuthContext);

// --- HELPER & UI COMPONENTS ---

const Header = ({ setPage }) => {
    const { isAuthenticated, user, logout } = useAuth();
    
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
        <header className="bg-cyan-600 text-white shadow-lg sticky top-0 z-50">
            <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
                {/* Home Text Link */}
                <div onClick={() => setPage('home')} className="cursor-pointer text-2xl font-extrabold flex items-center group hover:text-cyan-200 transition">
                    Service Connect
                </div>
                <div className="hidden md:flex items-center space-x-8">
                    <a onClick={() => setPage('home')} className="hover:text-blue-200 font-medium cursor-pointer transition duration-150">Home</a>
                    <a onClick={() => setPage('allServices')} className="hover:text-blue-200 font-medium cursor-pointer transition duration-150">Services</a>
                    <a onClick={() => setPage('about')} className="hover:text-blue-200 font-medium cursor-pointer transition duration-150">About</a>
                    <a onClick={() => setPage('contact')} className="hover:text-blue-200 font-medium cursor-pointer transition duration-150">Contact</a>
                </div>
                <div className="flex items-center space-x-4">
                    {isAuthenticated ? (
                        <>
                            <button onClick={() => setPage(getDashboardPage())} className="text-white font-semibold hover:text-blue-200 transition">Dashboard</button>
                            <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-md hover:bg-red-600 transition">
                                Logout
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setPage('login')} className="bg-white text-cyan-600 px-4 py-2 rounded-lg shadow-md hover:bg-gray-100 transition font-bold">
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
                        <li><a className="text-gray-400 hover:text-blue-400 cursor-pointer transition">Testimonials</a></li>
                        <li><a className="text-gray-400 hover:text-blue-400 cursor-pointer transition">Reviews</a></li>
                    </ul>
                </div>
                {/* Section 2: Company */}
                <div>
                    <h4 className="font-semibold mb-4 text-gray-200">Company</h4>
                    <ul className="space-y-2 text-sm">
                        <li><a onClick={() => setPage('about')} className="text-gray-400 hover:text-blue-400 cursor-pointer transition">About Us</a></li>
                        <li><a onClick={() => setPage('contact')} className="text-gray-400 hover:text-blue-400 cursor-pointer transition">Contact Us</a></li>
                        <li><a className="text-gray-400 hover:text-blue-400 cursor-pointer transition">Careers</a></li>
                    </ul>
                </div>
                 {/* Section 3: Services */}
                <div>
                    <h4 className="font-semibold mb-4 text-gray-200">Services</h4>
                    <ul className="space-y-2 text-sm">
                        <li><a onClick={() => setPage('allServices')} className="text-gray-400 hover:text-blue-400 cursor-pointer transition">All Services</a></li>
                        <li><a className="text-gray-400 hover:text-blue-400 cursor-pointer transition">Terms & Privacy</a></li>
                    </ul>
                </div>
                {/* Section 4: Connect With Us */}
                <div className="col-span-2 md:col-span-2">
                    <h4 className="font-semibold mb-4 text-gray-200">Connect With Us</h4>
                    <div className="flex space-x-4 text-2xl">
                        {/* Placeholder Social Icons */}
                        <a className="text-gray-400 hover:text-blue-400 transition">f</a>
                        <a className="text-gray-400 hover:text-blue-400 transition">t</a>
                        <a className="text-gray-400 hover:text-blue-400 transition">in</a>
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
            <img className="w-16 h-16 rounded-full object-cover shadow-md" src={`https://placehold.co/150x150/E0E7FF/4338CA?text=${provider.display_name.charAt(0)}`} alt={provider.display_name} />
            <div className="flex-grow">
                <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-bold text-slate-800">{provider.display_name}</h3>
                    {provider.is_verified && <span title="Verified Professional" className="bg-blue-100 text-blue-800 text-xs font-semibold px-1 py-0.5 rounded-full border border-blue-300">✓</span>}
                </div>
                <p className="text-xs font-semibold text-gray-500">{provider.service_name || 'Service Expert'}</p>
            </div>
        </div>

        <div className="flex justify-between items-center border-t pt-3">
            <div className="flex items-center text-sm">
                <span className="text-amber-500 mr-1 text-lg font-extrabold">{parseFloat(provider.average_rating || 0).toFixed(1)}/5</span>
                <span className="ml-2 text-gray-500 text-xs">({provider.review_count || 0} reviews)</span>
            </div>
            <button className="bg-blue-600 text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-blue-700 transition">
                View Profile
            </button>
        </div>
    </div>
);

const Spinner = () => <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div></div>;
const ErrorMessage = ({ message }) => <div className="text-center text-red-700 bg-red-100 p-4 rounded-lg my-4 font-medium border border-red-300">{message}</div>;
const SuccessMessage = ({ message }) => <div className="text-center text-green-700 bg-green-100 p-4 rounded-lg my-4 font-medium border border-green-300">{message}</div>;

const HowItWorksCard = ({ icon, title, description, stars }) => (
    <div className="flex flex-col items-center text-center bg-white p-6 rounded-xl shadow-lg border border-gray-100 w-full">
        <div className="text-4xl text-blue-600 mb-3">{icon}</div>
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

const BookingModal = ({ provider, service, onClose, onBooked }) => {
    const { token, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

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
            service_description: e.target.service_description.value, // New field
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
                setTimeout(() => onBooked(), 2000);
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
                <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400">
                    {loading ? 'Sending Request...' : 'Confirm & Send Request'}
                </button>
            </form>
        </Modal>
    );
};

const ReviewAndPaymentModal = ({ booking, onClose, onCompleted }) => {
    const { token } = useAuth();
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState(booking.booking_status === 'closed' ? 'success' : 'pending'); 

    const handlePayment = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const mockAmount = 500; // Mock payment amount

        try {
            const response = await fetch(`${API_BASE_URL}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                // Mocking payment token
                body: JSON.stringify({ booking_id: booking.id, amount: mockAmount, payment_token: 'MOCK_TOKEN_XYZ' }),
            });
            const data = await response.json();

            if (response.ok) {
                setSuccess('Payment successful! You can now optionally leave a review.');
                setPaymentStatus('success');
            } else {
                setError(data.error || 'Payment failed.');
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

        if (paymentStatus !== 'success') {
            setError('Please complete the payment first before submitting a review.');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ booking_id: booking.id, rating: rating, comment: comment }),
            });
            const data = await response.json();
            
            if (response.ok) {
                setSuccess(data.message);
                // Optionally close immediately, but refresh is handled by onCompleted
                onCompleted(); 
            } else {
                setError(data.error || 'Review submission failed.');
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
                    ⭐
                </span>
            ))}
        </div>
    );
    
    const isPaymentPending = booking.booking_status === 'completed' && paymentStatus !== 'success';
    const isReadyToReview = paymentStatus === 'success';

    return (
        <Modal title={`Payment & Review for Booking #${booking.id}`} onClose={onClose}>
            {error && <ErrorMessage message={error} />}
            {success && <SuccessMessage message={success} />}

            {/* --- Payment Section (Only visible if not yet paid) --- */}
            {isPaymentPending && (
                <div className="bg-red-50 p-4 rounded-lg mb-4 border border-red-200">
                    <h3 className="text-xl font-bold text-red-700 mb-3">1. Complete Payment (Required)</h3>
                    <p className="mb-3 text-gray-700">Service Fee: **₹500.00**</p>
                    <button onClick={handlePayment} disabled={loading} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400">
                        {loading ? 'Processing...' : 'Pay ₹500.00 Now'}
                    </button>
                </div>
            )}
            
            {/* --- Review Section (Only visible after successful payment) --- */}
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
                            {loading ? 'Submitting...' : 'Submit Review'}
                        </button>
                    </form>
                </div>
            )}
            
            <div className="mt-4 text-right">
                <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 font-medium">Close</button>
            </div>

        </Modal>
    );
};

const ChatComponent = ({ booking, onClose, isCustomer }) => {
    const { token, user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Scroll ref for chat window
    const messagesEndRef = React.useRef(null);
    
    const fetchMessages = useCallback(async () => {
        setLoading(true);
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
        fetchMessages();
        
        // Mock Real-Time Polling (Replace with WebSockets/Socket.io in production)
        const interval = setInterval(fetchMessages, 5000); 
        return () => clearInterval(interval);
        
    }, [fetchMessages]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !token) return;
        
        const content = newMessage.trim();
        setNewMessage('');
        
        // Add optimistic update (mock message)
        setMessages(prev => [...prev, { 
            id: Date.now(), 
            sender_id: user.id, 
            sender_email: user.email,
            content: content, 
            created_at: new Date().toISOString() 
        }]);
        
        try {
            const response = await fetch(`${API_BASE_URL}/bookings/${booking.id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ content }),
            });

            if (!response.ok) {
                console.error('Failed to send message:', await response.json());
                setError('Failed to send message.');
            } else {
                // Fetch actual messages to ensure data integrity
                fetchMessages();
            }
        } catch (err) {
            console.error('Network error during send:', err);
            setError('Network error occurred while sending message.');
        }
    };
    
    const chatTitle = isCustomer 
        ? `Chat with ${booking.provider_name}`
        : `Chat with Customer (${booking.customer_email})`;
        
    const isChatActive = booking.booking_status === 'accepted';

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
                                    <div className={`max-w-xs md:max-w-md px-4 py-2 rounded-xl shadow-md ${isSender ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-200 text-slate-800 rounded-tl-none'}`}>
                                        <p className="text-xs font-semibold mb-1 opacity-75">{isSender ? 'You' : msg.sender_email}</p>
                                        <p className="text-sm">{msg.content}</p>
                                        <span className="text-xs block mt-1 text-right opacity-75">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>
                
                {/* Input Area */}
                <form onSubmit={handleSendMessage} className="p-4 bg-white border-t flex space-x-3">
                    <input 
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={isChatActive ? "Type your message..." : "Chat is disabled until accepted"}
                        className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        disabled={!isChatActive}
                    />
                    <button 
                        type="submit" 
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition disabled:bg-gray-400"
                        disabled={!newMessage.trim() || !isChatActive}
                    >
                        Send
                    </button>
                </form>
            </div>
            {!isChatActive && <p className="text-center text-sm text-red-500 mt-2">Chat is only active when the booking status is 'accepted'.</p>}
        </Modal>
    );
};


const BookingCard = ({ booking, handleAction, isCustomer, onReviewModalOpen, onChatModalOpen }) => {
    // Helper to determine color based on status
    const getStatusClasses = (status) => {
        switch (status) {
            case 'pending_provider': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
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
    
    // Customer Actions
    const customerActions = (
        <div className="flex flex-col space-y-3">
            {/* Review & Payment button (Active when completed/unpaid) */}
            <button 
                className={`text-white px-4 py-2 rounded-lg font-semibold transition shadow-md ${
                    booking.booking_status === 'completed' 
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'hidden'
                }`}
                onClick={() => onReviewModalOpen(booking)}
            >
                Pay & Review
            </button>
            
            {/* Chat button (Active when accepted or closed) */}
            {(booking.booking_status === 'accepted' || booking.booking_status === 'closed') && (
                 <button 
                    className="bg-cyan-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-cyan-700 transition shadow-md"
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
                        onClick={() => handleAction(booking.id, 'accepted')} 
                        className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition shadow-md"
                    >
                        Accept
                    </button>
                    <button 
                        onClick={() => handleAction(booking.id, 'rejected')} 
                        className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition shadow-md"
                    >
                        Reject
                    </button>
                </div>
            )}
            
            {booking.booking_status === 'accepted' && (
                 <div className="space-y-3">
                    <button 
                        onClick={() => handleAction(booking.id, 'completed')} 
                        className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition shadow-md"
                    >
                        Mark Completed
                    </button>
                    <button 
                        className="bg-cyan-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-cyan-700 transition shadow-md"
                        onClick={() => onChatModalOpen(booking)}
                    >
                        Chat Now
                    </button>
                 </div>
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


// --- PAGE COMPONENTS ---

const HomePage = ({ setPage, setSelectedService, setSearchParams }) => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Updated to use placeholder text
    const [searchQuery, setSearchQuery] = useState('');
    const [searchLocation, setSearchLocation] = useState('');

    useEffect(() => {
        const fetchServices = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/services`);
                if (!res.ok) throw new Error('Failed to fetch services. Is the backend running?');
                const data = await res.json();
                setServices(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchServices();
    }, []);

    const handleServiceClick = (service) => {
        setSelectedService(service);
        setPage('serviceProviders');
    };
    
    // Handle Search Submission (making it functional)
    const handleSearch = () => {
        // Simple validation/data extraction
        const [lat, lon] = searchLocation.split(',').map(s => s.trim());
        
        setSearchParams({ 
            query: searchQuery, 
            lat: parseFloat(lat) || null,
            lon: parseFloat(lon) || null,
        });
        setPage('allServices');
    };

    return (
        <main>
            {/* HERO SECTION - Service Connect Style */}
            <section className="bg-cyan-600 pt-0 pb-40 relative overflow-hidden">
                <div className="container mx-auto px-6 relative z-10">
                    
                    <div className="absolute inset-x-0 bottom-0 h-[450px] opacity-90 overflow-hidden">
                        <img 
                            src="https://placehold.co/1200x500/06B6D4/FFFFFF?text=Trusted+Experts+Team+Graphic" 
                            alt="Service Connect professionals background"
                            className="w-full h-full object-cover object-top"
                        />
                    </div>

                    <div className="relative text-left pt-16 pb-40">
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-8 max-w-xl leading-tight">
                            Your trusted experts at your doorstep
                        </h1>
                        
                        {/* Search Bar Block - Functional placeholders */}
                        <div className="bg-white p-2 rounded-xl shadow-2xl flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-2 max-w-4xl">
                            {/* What service */}
                            <input 
                                type="text" 
                                placeholder="What service are you looking for?" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="flex-grow p-3 border-r border-gray-200 focus:outline-none rounded-lg text-lg w-full md:w-auto" 
                            />
                            {/* Location */}
                            <div className="relative flex items-center w-full md:w-auto">
                                <span className="absolute left-3 text-gray-400">📍</span>
                                <input 
                                    type="text" 
                                    placeholder="Your Location (e.g., Lat, Lon)" 
                                    value={searchLocation}
                                    onChange={(e) => setSearchLocation(e.target.value)}
                                    className="pl-8 p-3 w-full focus:outline-none rounded-lg text-lg border-r border-gray-200 md:border-r-0" 
                                />
                            </div>
                            {/* Search Button */}
                            <button onClick={handleSearch} className="bg-teal-500 text-white font-bold px-8 py-3 rounded-xl hover:bg-teal-600 transition w-full md:w-auto text-lg shadow-md">
                                Search
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Popular Services Section - Repositioned and Styled */}
            <section className="py-16 -mt-32 relative z-20 bg-gray-50">
                <div className="container mx-auto px-6">
                    <h2 className="text-2xl font-extrabold text-slate-800 mb-8">Popular Services</h2>
                    
                    {loading && <Spinner />}
                    {error && <ErrorMessage message={error} />}
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        {(services || []).slice(0, 6).map((service, index) => (
                            <ServiceCard key={service.id} service={{...service, icon: index === 0 ? '🔧' : index === 1 ? '💡' : index === 2 ? '🔨' : '🛠️'}} onClick={handleServiceClick} />
                        ))}
                    </div>

                    {/* How It Works Section - Matching Image Style */}
                    <h2 className="text-2xl font-extrabold text-slate-800 mb-8 mt-16">How It Works</h2>
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
            const searchLat = lat || 0; 
            const searchLon = lon || 0; 
            
            try {
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
            <button onClick={() => setPage('allServices')} className="text-blue-600 hover:text-blue-800 font-medium transition mb-8 flex items-center">&larr; Back to all services</button>
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
    const { isAuthenticated, user, setPage: navigate } = useAuth();
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

    // Mock data for Service name since provider doesn't contain it directly
    const mockServiceName = service?.name || 'Service Professional';

    if (!provider) return <ErrorMessage message="No provider selected." />;
    
    const portfolio = [
        "https://placehold.co/400x300/F0F4FF/4338CA?text=Portfolio+Image+1",
        "https://placehold.co/400x300/E0E7FF/4338CA?text=Portfolio+Image+2",
        "https://placehold.co/400x300/D1E0FF/4338CA?text=Portfolio+Image+3",
    ];

    const handleRequestService = () => {
        if (!isAuthenticated || user?.role !== 'customer') {
            console.log("[UI Notification] Please log in as a customer to request a service.");
            navigate('login'); 
        } else {
            setIsBookingModalOpen(true);
        }
    };
    
    const handleBookingSuccess = () => {
        setIsBookingModalOpen(false);
        navigate('customerDashboard');
    };
    
    return (
        <div className="container mx-auto px-6 py-16">
            <button onClick={() => setPage('serviceProviders')} className="text-blue-600 hover:text-blue-800 font-medium transition mb-8 flex items-center">&larr; Back to Providers</button>
            
            <div className="bg-white rounded-xl shadow-2xl p-6 lg:p-10 border border-gray-200">
                
                {/* Header Section */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b pb-6 mb-6">
                    <div className="flex items-center space-x-6">
                        <img className="w-32 h-32 rounded-full object-cover shadow-xl border-4 border-white ring-2 ring-blue-500" 
                            src={`https://placehold.co/150x150/E0E7FF/4338CA?text=${provider.display_name.charAt(0)}`} 
                            alt={provider.display_name} 
                        />
                        <div>
                            <h1 className="text-3xl font-extrabold text-slate-800">{provider.display_name}</h1>
                            <p className="text-lg text-blue-600 font-semibold mb-2">{mockServiceName}</p>
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
                        className="mt-6 lg:mt-0 bg-blue-600 text-white text-lg font-bold px-8 py-3 rounded-lg hover:bg-blue-700 transition shadow-lg"
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
                            <li><span className="font-semibold">Avg Rate:</span> $40/hr (Estimated)</li>
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
                />
            )}
        </div>
    );
};


const AboutPage = () => {
    return (
        <div className="bg-white">
            <div className="container mx-auto px-6 py-20">
                <div className="text-center">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4">About Service Connect</h1>
                    <p className="text-xl text-gray-600 max-w-4xl mx-auto">
                        Connecting communities with reliable local professionals. Our mission is to build trust in local services.
                    </p>
                </div>
            </div>
        </div>
    );
};


const ContactPage = () => {
    return (
         <div className="container mx-auto px-6 py-16">
            <h1 className="text-4xl font-bold text-slate-800 mb-4 text-center">Get in Touch</h1>
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
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const email = e.target.email.value;
        const password = e.target.password.value;
        const result = await login(email, password);
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
                <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md font-bold text-white bg-blue-600 hover:bg-blue-700 transition">Sign in</button>
            </form>
            <div className="mt-6 text-center text-sm">
                Don't have an account? <a onClick={() => setPage('register')} className="font-medium text-blue-600 hover:text-blue-700 cursor-pointer transition">Register here</a>
            </div>
        </AuthFormContainer>
    );
};


const RegisterPage = ({ setPage }) => {
    const { register, login } = useAuth();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [services, setServices] = useState([]);
    const [role, setRole] = useState('customer');
    const [primaryService, setPrimaryService] = useState('');

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
        setError(''); setSuccess('');
        const email = e.target.email.value;
        const password = e.target.password.value;
        
        const result = await register(email, password, role);
        if (result.success) {
            setSuccess(result.message + " Logging you in...");
            
            const loginResult = await login(email, password);
            
            if (loginResult.success) {
                if (role === 'provider') {
                    setPage('providerSetup', { primaryServiceId: primaryService });
                } else {
                    setPage('customerDashboard');
                }
            } else {
                setPage('login'); 
            }
        } else {
            setError(result.message || "Registration failed.");
        }
    };

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
                <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md font-bold text-white bg-blue-600 hover:bg-blue-700 transition">Create Account</button>
            </form>
            <div className="mt-6 text-center text-sm">
                Already have an account? <a onClick={() => setPage('login')} className="font-medium text-blue-600 hover:text-blue-700 cursor-pointer transition">Sign in</a>
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

        const profileData = {
            display_name: e.target.display_name.value,
            bio: e.target.bio.value,
            location_lat: parseFloat(e.target.lat.value), 
            location_lon: parseFloat(e.target.lon.value),
            service_radius_km: parseInt(e.target.radius.value, 10),
            service_ids: [pageData.primaryServiceId],
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
                {error && <ErrorMessage message={error}/>}
                {success && <SuccessMessage message={success}/>}
                <button type="submit" disabled={loading} className="w-full flex justify-center py-3 px-4 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md disabled:bg-gray-400">
                    {loading ? 'Saving Profile...' : 'Complete Setup & Go Live'}
                </button>
            </form>
        </AuthFormContainer>
    );
};


// --- Dashboard Layout and Helper Components ---

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
                                             className={`block px-4 py-3 rounded-lg cursor-pointer transition-colors text-lg ${activeTab === item.tab ? 'bg-blue-600 text-white font-bold shadow-md' : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'}`}
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

// --- CUSTOMER DASHBOARD COMPONENTS ---

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
                />
            ))}
            
            {activeModal === 'review' && selectedBooking && (
                <ReviewAndPaymentModal 
                    booking={selectedBooking} 
                    onClose={() => setActiveModal(null)} 
                    onCompleted={fetchBookings} // Refresh bookings after review/payment
                />
            )}
            
            {activeModal === 'chat' && selectedBooking && (
                <ChatComponent
                    booking={selectedBooking}
                    onClose={() => setActiveModal(null)} 
                    isCustomer={true}
                />
            )}
        </div>
    );
};

const CustomerProfileManagement = () => {
    const { user, token, fetchUserProfile } = useAuth();
    // Updated to use lat/lon instead of zip_code
    const [profileData, setProfileData] = useState({
        email: user?.email || '',
        full_name: getProfileField(user, 'full_name'),
        phone_number: getProfileField(user, 'phone_number'),
        address_line_1: getProfileField(user, 'address_line_1'),
        city: getProfileField(user, 'city'),
        location_lat: getProfileField(user, 'location_lat', 0),
        location_lon: getProfileField(user, 'location_lon', 0),
    });
    
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setProfileData({
                email: user.email || '',
                full_name: getProfileField(user, 'full_name'),
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
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess(''); setLoading(true);

        // Ensure lat/lon are sent as numbers
        const dataToSend = {
             ...profileData,
             location_lat: parseFloat(profileData.location_lat),
             location_lon: parseFloat(profileData.location_lon),
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/user/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token,
                },
                body: JSON.stringify(dataToSend),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                setSuccess('Profile updated successfully! Refreshing data...');
                await fetchUserProfile(token); 
            } else {
                setError(data.error || 'Failed to update profile. Email might be in use.');
            }
        } catch (err) {
            setError('A network error occurred while submitting the update.');
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
                <h3 className="text-lg font-semibold text-blue-600 border-b pb-2">Account Details</h3>
                <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700">Email Address (Login)</label>
                    <input 
                        id="email" 
                        name="email" 
                        type="email" 
                        value={profileData.email}
                        onChange={handleChange}
                        required 
                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" 
                        disabled={loading}
                    />
                </div>

                <h3 className="text-lg font-semibold text-blue-600 border-b pb-2 pt-4">Personal Details</h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="full_name" className="block text-sm font-semibold text-gray-700">Full Name</label>
                        <input id="full_name" name="full_name" type="text" value={profileData.full_name} onChange={handleChange} className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" />
                    </div>
                    <div>
                        <label htmlFor="phone_number" className="block text-sm font-semibold text-gray-700">Phone Number</label>
                        <input id="phone_number" name="phone_number" type="tel" value={profileData.phone_number} onChange={handleChange} className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" />
                    </div>
                </div>
                
                <h3 className="text-lg font-semibold text-blue-600 border-b pb-2 pt-4">Default Location</h3>
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

                <p className="text-sm text-gray-500">Your Role: <span className="font-semibold text-blue-600">{user?.role?.toUpperCase()}</span></p>
                
                <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-md disabled:bg-gray-400">
                    {loading ? 'Saving...' : 'Update Profile'}
                </button>
            </form>
        </div>
    );
}

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


const CustomerDashboard = ({ setPage }) => {
    const [activeTab, setActiveTab] = useState('bookings');
    const navItems = [
        { tab: 'bookings', label: 'My Bookings' },
        { tab: 'findServices', label: 'Find a Service' }, 
        { tab: 'profile', label: 'My Profile' },
    ];
    
    const renderTab = () => {
        switch (activeTab) {
            case 'bookings': return <CustomerBookingHistory />;
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


const ProviderProfileManagement = () => {
    const { user, token } = useAuth();
    const [profile, setProfile] = useState(null);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

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

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token, user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
        const formData = new FormData(e.target);
        
        const serviceIds = formData.get('primary_service_id') ? [formData.get('primary_service_id')] : [];
        
        if (serviceIds.length === 0) {
            setError('Please select a primary service category.');
            return;
        }
        
        const profileData = {
            display_name: formData.get('display_name'),
            bio: formData.get('bio'),
            location_lat: parseFloat(formData.get('location_lat')),
            location_lon: parseFloat(formData.get('location_lon')),
            service_radius_km: parseInt(formData.get('service_radius_km'), 10),
            service_ids: serviceIds,
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
            
            if (response.ok) {
                setSuccess('Profile updated successfully!');
                fetchData(); // Refresh data
            } else {
                setError(data.error || 'Failed to update profile.');
            }
        } catch (err) {
            setError('A network error occurred while submitting the update.');
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
                
                <h3 className="text-lg font-bold text-slate-700 border-b pb-2">Service Area</h3>
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
                
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-md">
                    Save Profile Updates
                </button>
            </form>
        </div>
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
    
    const pendingBookings = bookings.filter(b => b.booking_status === 'pending_provider' || b.booking_status === 'accepted');
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
                />
            ))}
            
            <h3 className="text-xl font-semibold text-slate-800 border-b pb-2 mt-10">Booking History ({historyBookings.length})</h3>
            {historyBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} isCustomer={false} handleAction={() => {}} />
            ))}
            
            {activeModal === 'chat' && selectedBooking && (
                <ChatComponent
                    booking={selectedBooking}
                    onClose={() => setActiveModal(null)} 
                    isCustomer={false}
                />
            )}

        </div>
    );
};

const ProviderEarnings = () => {
    // Mock data for analytics
    const mockData = {
        totalEarnings: 8500,
        completedJobs: 42,
        avgRating: 4.85,
        lastPayout: 2500,
        nextPayout: '2025-11-01',
    };
    
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-700">Your Payouts & Performance Analytics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <div className="bg-green-100 text-green-800 p-6 rounded-xl shadow-lg border border-green-300">
                    <p className="text-sm font-medium">Total Earnings</p>
                    <h3 className="text-3xl font-extrabold mt-1">₹{mockData.totalEarnings.toLocaleString()}</h3>
                </div>
                <div className="bg-blue-100 text-blue-800 p-6 rounded-xl shadow-lg border border-blue-300">
                    <p className="text-sm font-medium">Completed Jobs</p>
                    <h3 className="text-3xl font-extrabold mt-1">{mockData.completedJobs}</h3>
                </div>
                <div className="bg-amber-100 text-amber-800 p-6 rounded-xl shadow-lg border border-amber-300">
                    <p className="text-sm font-medium">Average Rating</p>
                    <h3 className="text-3xl font-extrabold mt-1">⭐ {mockData.avgRating.toFixed(2)}</h3>
                </div>
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
            case 'earnings': return <ProviderEarnings />;
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
        { tab: 'users', label: 'Manage Users' },
        { tab: 'providers', label: 'Provider Verification' },
        { tab: 'bookings', label: 'All Bookings' },
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
        if (token) {
            fetchData('users', setUsers);
            fetchData('providers', setProviders);
            fetchData('bookings', setBookings);
        }
    }, [token, fetchData]);

    useEffect(() => {
        if (token && activeTab === 'users') fetchData('users', setUsers);
        if (token && activeTab === 'providers') fetchData('providers', setProviders);
        if (token && activeTab === 'bookings') fetchData('bookings', setBookings);
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
            b.booking_status === 'pending_provider' ? 'bg-yellow-100 text-yellow-700' :
            'bg-blue-100 text-blue-700'
        }`}>{b.booking_status.replace('_', ' ')}</span>,
        formatDate(b.created_at)
    ]);


    return (
        <DashboardLayout navItems={navItems} activeTab={activeTab} setActiveTab={setActiveTab} title="Platform Administration">
            {activeTab === 'overview' && 
                <div className="space-y-6">
                    <h2 className="text-2xl font-semibold mb-4 text-slate-700">Key Platform Metrics</h2>
                    <p className="text-gray-600">This data is fetched live from your backend APIs to provide an overview.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                        <div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg">
                            <p className="text-sm font-medium opacity-80">Total Users</p>
                            <h3 className="text-3xl font-extrabold mt-1">{users.length > 0 ? users.length : '0'}</h3>
                        </div>
                        <div className="bg-green-600 text-white p-6 rounded-xl shadow-lg">
                            <p className="text-sm font-medium opacity-80">Total Bookings</p>
                            <h3 className="text-3xl font-extrabold mt-1">{bookings.length > 0 ? bookings.length : '0'}</h3>
                        </div>
                        <div className="bg-yellow-600 text-white p-6 rounded-xl shadow-lg">
                            <p className="text-sm font-medium opacity-80">Pending Verification</p>
                            <h3 className="text-3xl font-extrabold mt-1">{providers.filter(p => !p.is_verified).length}</h3>
                        </div>
                    </div>
                    {loading && <Spinner />}
                    {error && <ErrorMessage message={error} />}
                </div>
            }
            {activeTab === 'users' && <AdminTable title="All Users" headers={['ID', 'Email', 'Role', 'Registered On']} data={userTableData} />}
            {activeTab === 'providers' && <AdminTable 
                title="Provider Verification Queue" 
                headers={['ID', 'Name', 'Services', 'Reviews', 'Status', 'Actions']} 
                data={providerTableData} 
                actionHandler={handleVerify} 
            />}
            {activeTab === 'bookings' && <AdminTable title="All Platform Bookings" headers={['ID', 'Provider', 'Customer Email', 'Scheduled', 'Status', 'Created On']} data={bookingTableData} />}
        </DashboardLayout>
    );
};


// --- MAIN APP COMPONENT ---

export default function App() {
    const [page, setPage] = useState('home');
    const [pageData, setPageData] = useState(null);
    const [selectedService, setSelectedService] = useState(null);
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [searchParams, setSearchParams] = useState(null); // For global search state

    const navigate = (pageName, data = null) => {
        setPageData(data);
        setPage(pageName);
        window.scrollTo(0, 0); // Scroll to top on page change
    };

    const renderPage = () => {
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
        <AuthProvider>
            <div className="flex flex-col min-h-screen font-sans bg-gray-50">
                <Header setPage={navigate} />
                <main className="flex-grow">
                    {renderPage()}
                </main>
                <Footer setPage={navigate} />
            </div>
        </AuthProvider>
    );
}
