import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

// --- API Configuration ---
const API_BASE_URL = 'http://localhost:3001/api/v1';

// --- Asset Components ---

const Logo = () => (
    // Updated logo color to integrate better with the overall design
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block mr-2 text-white group-hover:text-blue-600 transition">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);


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
            if (response.ok) {
                const data = await response.json();
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

    // --- Forgot Password Methods (Client-side implementation) ---
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
        // Header updated to match the image's dark cyan background
        <header className="bg-cyan-600 text-white shadow-lg sticky top-0 z-50">
            <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
                <div onClick={() => setPage('home')} className="cursor-pointer text-2xl font-extrabold flex items-center group">
                    <svg className="inline-block mr-2 text-white w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 12L12 3L21 12M7 10V21H17V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    ServiceHub
                </div>
                <div className="hidden md:flex items-center space-x-8">
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
    // Footer structure updated to match the image's alignment and sections
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
                &copy; {new Date().getFullYear()} ServiceHub. All rights reserved.
            </div>
        </div>
    </footer>
);


const ServiceCard = ({ service, onClick }) => (
    // Simplified card style matching the image's small, iconic boxes
    <div
        onClick={() => onClick(service)}
        className="bg-white p-4 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col items-center text-center border border-gray-200 group"
    >
        <div className="text-3xl mb-2 p-2 bg-blue-50 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">{service.icon || '⚡'}</div>
        <h3 className="text-md font-bold text-slate-800 mb-1 group-hover:text-blue-600">{service.name.split(' ')[0]}</h3>
        {/* Added placeholder for a second line of text, if available */}
        <p className="text-gray-500 text-xs line-clamp-1">{service.id_name || service.description.split(' ')[1] || 'Service'}</p>
    </div>
);


const ProviderCard = ({ provider, onClick }) => (
    // Refined provider card emphasizing verification and rating
    <div onClick={() => onClick(provider)} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer flex flex-col p-4 space-y-3 border border-gray-200 min-w-[280px]">
        
        <div className="flex items-center space-x-3">
            <img className="w-16 h-16 rounded-full object-cover shadow-md" src={`https://placehold.co/150x150/E0E7FF/4338CA?text=${provider.display_name.charAt(0)}`} alt={provider.display_name} />
            <div className="flex-grow">
                <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-bold text-slate-800">{provider.display_name}</h3>
                    {provider.is_verified && <span title="Verified Professional" className="bg-blue-100 text-blue-800 text-xs font-semibold px-1 py-0.5 rounded-full border border-blue-300">✓</span>}
                </div>
                <p className="text-xs font-semibold text-gray-500">{provider.service_name || 'Master Plumber'}</p>
            </div>
        </div>

        <div className="flex justify-between items-center border-t pt-3">
            <div className="flex items-center text-sm">
                <span className="text-amber-500 mr-1 text-lg font-extrabold">{parseFloat(provider.average_rating || 4.9).toFixed(1)}/5</span>
                <span className="ml-2 text-gray-500 text-xs">({provider.review_count || 150} reviews)</span>
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

// Helper function for the How It Works section
const HowItWorksCard = ({ icon, title, description, stars }) => (
    <div className="flex flex-col items-center text-center bg-white p-6 rounded-xl shadow-lg border border-gray-100 w-full">
        <div className="text-4xl text-blue-600 mb-3">{icon}</div>
        <h3 className="text-lg font-semibold text-slate-800 mb-1">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
        {stars && <p className="text-amber-500 mt-1">{stars}</p>}
    </div>
);

// --- PAGE COMPONENTS ---

const HomePage = ({ setPage, setSelectedService }) => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchLocation, setSearchLocation] = useState('Your Location'); 
    const [searchQuery, setSearchQuery] = useState('What service are you looking for?');

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
    
    // --- Hero Section Overhaul ---
    return (
        <main>
            {/* HERO SECTION - Matching the Image's Header Color and Image Overlay */}
            <section className="bg-cyan-600 pt-0 pb-40 relative overflow-hidden">
                <div className="container mx-auto px-6 relative z-10">
                    
                    {/* Placeholder for the background group of professionals */}
                    <div className="absolute inset-x-0 bottom-0 h-[450px] opacity-90 overflow-hidden">
                        <img 
                            // Using a placeholder that suggests people behind the text
                            src="https://placehold.co/1200x500/06B6D4/FFFFFF?text=Trusted+Experts+Team+Graphic" 
                            alt="Service professionals background"
                            className="w-full h-full object-cover object-top"
                        />
                    </div>

                    <div className="relative text-left pt-16 pb-40">
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-8 max-w-xl leading-tight">
                            Your trusted experts at your doorstep
                        </h1>
                        
                        {/* Search Bar Block - Matching Image Style */}
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
                                    placeholder="Your Location" 
                                    value={searchLocation}
                                    onChange={(e) => setSearchLocation(e.target.value)}
                                    className="pl-8 p-3 w-full focus:outline-none rounded-lg text-lg border-r border-gray-200 md:border-r-0" 
                                />
                            </div>
                            {/* Search Button */}
                            <button onClick={() => setPage('allServices')} className="bg-teal-500 text-white font-bold px-8 py-3 rounded-xl hover:bg-teal-600 transition w-full md:w-auto text-lg shadow-md">
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
                    
                    {/* Service Cards Grid - Adjusted to 6 columns for the image layout */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        {(services || []).slice(0, 6).map((service, index) => (
                            <ServiceCard key={service.id} service={{...service, icon: index === 0 ? '🔧' : index === 1 ? '💡' : index === 2 ? '🔨' : '🛠️'}} onClick={handleServiceClick} />
                        ))}
                    </div>

                    {/* Top-Rated Professionals Section */}
                    <h2 className="text-2xl font-extrabold text-slate-800 mb-8 mt-16">Top-Rated Professionals</h2>
                    <div className="flex space-x-6 overflow-x-auto pb-4">
                        {/* Mock Provider Cards (using the ProviderCard component) */}
                        <ProviderCard provider={{display_name: 'Rajesh K.', is_verified: true, average_rating: '4.9', review_count: 150, bio: 'Master Plumber and pipe expert.', provider_id: 99}} onClick={() => setPage('providerDetail')} />
                        <ProviderCard provider={{display_name: 'Sunita D.', is_verified: true, average_rating: '4.9', review_count: 120, bio: 'Expert AC and Refrigerator repair technician.', provider_id: 98}} onClick={() => setPage('providerDetail')} />
                         <ProviderCard provider={{display_name: 'Ramesh V.', is_verified: false, average_rating: '4.5', review_count: 80, bio: 'Dedicated house cleaning specialist.', provider_id: 97}} onClick={() => setPage('providerDetail')} />
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
                    
                    {/* Testimonials Placeholder */}
                    <div className="mt-16 text-center text-gray-700">
                        <h2 className="text-2xl font-extrabold text-slate-800 mb-8">What Our Customers Say</h2>
                        <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg border-l-4 border-blue-600 italic text-lg">
                             "Service Connect made finding an electrician so easy and trustworthy. The quality of work was exceptional." - Priya S.
                        </div>
                    </div>

                </div>
            </section>
        </main>
    );
};


const AllServicesPage = ({ setPage, setSelectedService }) => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchServices = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/services`);
                if (!res.ok) throw new Error('Failed to fetch services. Is the backend running?');
                const data = await res.json();
                setServices(data || []);
            } catch (err) {
                setError(err.message || 'Failed to load services.');
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
    
    return (
        <div className="container mx-auto px-6 py-16">
            <h1 className="text-4xl font-bold text-slate-800 mb-10 text-center border-b pb-4">All Available Services</h1>
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

//here i changed 

const ServiceProvidersPage = ({ service, setPage, setSelectedProvider }) => {
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!service || !service.id) {
            setError('No service selected. Returning to service list.');
            setTimeout(() => setPage('allServices'), 2000);
            setLoading(false);
            return;
        }

        const fetchProviders = async () => {
            const lat = 12.9716, lon = 77.5946; 
            try {
                const res = await fetch(`${API_BASE_URL}/providers?service_id=${service.id}&lat=${lat}&lon=${lon}`);
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
    }, [service, setPage]);


    const handleProviderClick = (provider) => {
        setSelectedProvider(provider);
        setPage('providerDetail');
    };

    return (
        <div className="container mx-auto px-6 py-16">
            <button onClick={() => setPage('allServices')} className="text-blue-600 hover:text-blue-800 font-medium transition mb-8 flex items-center">&larr; Back to all services</button>
            <h1 className="text-4xl font-extrabold text-slate-800 mb-2">{service?.name || "Service Providers"}</h1>
            <p className="text-lg text-gray-600 mb-8 max-w-3xl">{service?.description}</p>
            
            {/* Filter Bar Placeholder - Styled for professional look */}
            <div className="bg-white p-4 rounded-xl shadow-inner mb-8 flex flex-wrap gap-4 items-center border border-gray-200">
                <span className="font-semibold text-slate-700">Filter & Sort:</span>
                <select className="p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
                    <option>Sort by Rating</option>
                    <option>Sort by Distance</option>
                </select>
                <input type="number" placeholder="Max Radius (km)" className="p-3 border border-gray-300 rounded-lg shadow-sm w-40" />
                <button className="bg-blue-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition">Apply</button>
            </div>
            
            {loading && <Spinner />}
            {error && <ErrorMessage message={error} />}
            <div className="space-y-6">
                {!loading && providers.length > 0 ? (
                    providers.map(provider => (
                        <ProviderCard key={provider.provider_id} provider={provider} onClick={handleProviderClick} />
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

const ProviderDetailPage = ({ provider, setPage }) => {
// ... (rest of ProviderDetailPage component remains the same)
// ...
// ...
    const { isAuthenticated, setPage: navigate } = useAuth();
    if (!provider) return <ErrorMessage message="No provider selected." />;
    
    // Mock Data for Detail Page
    const portfolio = [
        "https://placehold.co/400x300/F0F4FF/4338CA?text=Portfolio+Image+1",
        "https://placehold.co/400x300/E0E7FF/4338CA?text=Portfolio+Image+2",
        "https://placehold.co/400x300/D1E0FF/4338CA?text=Portfolio+Image+3",
    ];

    const handleRequestService = () => {
        if (!isAuthenticated) {
            alert("Please log in or register to request a service.");
            navigate('login'); 
        } else {
            // Placeholder for the actual booking modal
            alert(`Ready to book ${provider.display_name}. (Booking modal coming soon!)`);
        }
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
                            <p className="text-lg text-blue-600 font-semibold mb-2">{provider.service_name || 'Service Professional'}</p>
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
                    >
                        Request Service
                    </button>
                </div>
                
                {/* Details and Info */}
                <div className="grid md:grid-cols-3 gap-8 mb-10">
                    <div className="md:col-span-2">
                        <h2 className="text-2xl font-bold text-slate-700 mb-4 border-b pb-2">About the Professional</h2>
                        <p className="text-gray-700 leading-relaxed mb-6">{provider.bio || "This professional has not yet provided a detailed biography."}</p>
                        
                        <h3 className="text-xl font-bold text-slate-700 mb-3">Service Details</h3>
                        <ul className="list-disc list-inside text-gray-700 space-y-2">
                            <li><span className="font-semibold">Primary Service:</span> {provider.service_name || 'N/A'}</li>
                            <li><span className="font-semibold">Service Area:</span> {provider.service_radius_km || 10} km radius</li>
                            <li><span className="font-semibold">Avg Rate:</span> $40/hr (Estimated)</li>
                            <li><span className="font-semibold">Next Available:</span> Today at 4:00 PM</li>
                        </ul>
                    </div>
                    
                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
                        <h3 className="text-xl font-bold text-blue-700 mb-4">Contact Info</h3>
                        <p className="text-gray-700">Location: {provider.location_lat}, {provider.location_lon} (Mock)</p>
                        <p className="text-gray-700 mt-2">Contact: Available after booking</p>
                        <p className="text-sm text-gray-500 mt-4">For privacy and security, direct contact details are shared only after a booking is confirmed.</p>
                    </div>
                </div>
                
                {/* Portfolio Section */}
                <h2 className="text-2xl font-bold text-slate-700 mb-4 border-b pb-2">Portfolio & Work</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {portfolio.map((img, index) => (
                        <img key={index} src={img} alt={`Work ${index + 1}`} className="rounded-lg shadow-md w-full h-48 object-cover"/>
                    ))}
                </div>

                {/* Reviews Section */}
                <h2 className="text-2xl font-bold text-slate-700 mt-10 mb-6 border-b pb-2">Customer Reviews</h2>
                <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg border">
                        <div className="font-semibold">Customer A <span className="text-amber-500 ml-2">⭐⭐⭐⭐⭐</span></div>
                        <p className="text-gray-700 text-sm mt-1">"Rajesh was punctual, professional, and solved my electrical issue quickly. Highly recommend!"</p>
                        <span className="text-xs text-gray-500 mt-1 block">Date: 2025-09-28</span>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg border">
                        <div className="font-semibold">Customer B <span className="text-amber-500 ml-2">⭐⭐⭐⭐</span></div>
                        <p className="text-gray-700 text-sm mt-1">"Good work, but arrived 15 minutes late. Quality of repair was excellent."</p>
                        <span className="text-xs text-gray-500 mt-1 block">Date: 2025-09-15</span>
                    </div>
                </div>

            </div>
        </div>
    );
};


const AboutPage = () => {
// ... (rest of AboutPage component remains the same)
// ...
// ...
    return (
        <div className="bg-white">
            <div className="container mx-auto px-6 py-20">
                <div className="text-center">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4">About Service Connect</h1>
                    <p className="text-xl text-gray-600 max-w-4xl mx-auto">
                        Connecting communities with reliable local professionals. Our mission is to build trust in local services.
                    </p>
                </div>

                <div className="mt-16 grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="text-3xl font-bold text-blue-600 mb-4">Our Commitment to Quality</h2>
                        <p className="text-gray-700 leading-relaxed mb-4">
                            Every professional on our platform is thoroughly vetted, verified, and reviewed by real customers. We ensure skill, punctuality, and fair pricing are the foundation of every service booked through us.
                        </p>
                        <p className="text-gray-700 leading-relaxed">
                            We empower local workers to grow their businesses while providing unparalleled convenience and peace of mind to our customers.
                        </p>
                    </div>
                    <div>
                        <img src="https://placehold.co/600x400/E0E7FF/4338CA?text=Trusted+Experts" alt="Service Connect Team" className="rounded-xl shadow-2xl border border-gray-200"/>
                    </div>
                </div>
                
                <div className="mt-20">
                    <h2 className="text-3xl font-bold text-center text-slate-800 mb-10">Our Core Values</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                        <div className="bg-white p-8 rounded-xl shadow-lg border border-blue-100">
                            <div className="text-4xl text-blue-600 mb-3">🤝</div>
                            <h3 className="text-xl font-semibold text-slate-800 mb-2">Trust & Transparency</h3>
                            <p className="text-gray-600 text-sm">Clear communication and honest pricing every time.</p>
                        </div>
                        <div className="bg-white p-8 rounded-xl shadow-lg border border-blue-100">
                             <div className="text-4xl text-blue-600 mb-3">✨</div>
                            <h3 className="text-xl font-semibold text-slate-800 mb-2">Quality Execution</h3>
                            <p className="text-gray-600 text-sm">We only partner with highly-rated, skilled professionals.</p>
                        </div>
                        <div className="bg-white p-8 rounded-xl shadow-lg border border-blue-100">
                             <div className="text-4xl text-blue-600 mb-3">🚀</div>
                            <h3 className="text-xl font-semibold text-slate-800 mb-2">Seamless Experience</h3>
                            <p className="text-gray-600 text-sm">Easy booking, secure payments, and simple communication.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


const ContactPage = () => {
// ... (rest of ContactPage component remains the same)
// ...
// ...
    return (
         <div className="container mx-auto px-6 py-16">
            <h1 className="text-4xl font-bold text-slate-800 mb-4 text-center">Get in Touch</h1>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto text-center mb-12">We're here to help! Send us a message or find our contact information below.</p>
            <div className="grid md:grid-cols-2 gap-12">
                
                {/* Contact Form */}
                <form className="max-w-full bg-white p-8 rounded-xl shadow-2xl border border-gray-200">
                    <h2 className="text-2xl font-bold mb-6 text-blue-600">Send us a message</h2>
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-semibold text-gray-700">Full Name</label>
                            <input type="text" id="name" className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition" required />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-semibold text-gray-700">Email Address</label>
                            <input type="email" id="email" className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition" required />
                        </div>
                        <div>
                            <label htmlFor="message" className="block text-sm font-medium text-gray-700">Message</label>
                            <textarea id="message" rows="4" className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition" required></textarea>
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-md">Send Message</button>
                    </div>
                </form>
                
                {/* Contact Info */}
                <div className="bg-blue-50 p-8 rounded-xl shadow-lg border border-blue-200">
                    <h2 className="text-2xl font-bold mb-6 text-blue-700">Reach Us Directly</h2>
                    <div className="space-y-6 text-gray-700">
                        <div>
                            <h3 className="font-semibold text-lg text-slate-800">Customer Support</h3>
                            <p>Email: support@serviceconnect.com</p>
                            <p>Phone: +1 (555) 123-4567</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg text-slate-800">Address</h3>
                            <p>Service Connect HQ</p>
                            <p>101 Tech Hub Lane, Bangalore, 560001, India</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg text-slate-800">Business Hours</h3>
                            <p>Monday - Friday: 9:00 AM - 6:00 PM (IST)</p>
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
// ... (rest of LoginPage component remains the same)
// ...
// ...
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
        <AuthFormContainer title="Sign in to your account">
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
// ... (rest of RegisterPage component remains the same)
// ...
// ...
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
            
            // Auto-login after successful registration
            const loginResult = await login(email, password);
            
            if (loginResult.success) {
                if (role === 'provider') {
                    // Redirect provider to setup page
                    setPage('providerSetup', { primaryServiceId: primaryService });
                } else {
                    setPage('customerDashboard');
                }
            } else {
                setPage('login'); // Fallback to login if auto-login fails
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
                        <option value="admin">Admin (Testing/Setup)</option>
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
// ... (rest of ForgotPasswordPage component remains the same)
// ...
// ...
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
        
        const result = await sendOtp(submittedEmail); // API call
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

        const result = await resetPassword(email, otp, newPassword); // API call
        setLoading(false);
        
        if (result.success) {
            setMessage('Your password has been successfully reset. Redirecting to login...');
            setTimeout(() => setPage('login'), 2000);
        } else {
            setError(result.message || 'Invalid code or password.');
        }
    };
    
    // --- Step 2: OTP Verification and New Password ---
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

    // --- Step 1: Email Submission ---
    return (
        <AuthFormContainer title="Reset your password">
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
// ... (rest of ProviderSetupPage component remains the same)
// ...
// ...
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
            location_lat: parseFloat(e.target.lat.value) || 12.9716, // Default to Bangalore if missing
            location_lon: parseFloat(e.target.lon.value) || 77.5946,
            service_radius_km: parseInt(e.target.radius.value, 10) || 10,
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
                        <label htmlFor="lat" className="block text-sm font-semibold text-gray-700">Location Latitude (Default: Bangalore)</label>
                        <input id="lat" name="lat" type="number" step="any" defaultValue="12.9716" className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" />
                    </div>
                     <div>
                        <label htmlFor="lon" className="block text-sm font-semibold text-gray-700">Location Longitude</label>
                        <input id="lon" name="lon" type="number" step="any" defaultValue="77.5946" className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg" />
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


// --- Dashboard Pages ---

const DashboardLayout = ({ children, navItems, activeTab, setActiveTab, title }) => {
// ... (rest of DashboardLayout component remains the same)
// ...
// ...
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


const CustomerDashboard = () => {
// ... (rest of CustomerDashboard component remains the same)
// ...
// ...
    const [activeTab, setActiveTab] = useState('bookings');
    const { user } = useAuth();
    const navItems = [
        { tab: 'bookings', label: 'My Bookings' },
        { tab: 'profile', label: 'My Profile' },
    ];
    return (
        <DashboardLayout navItems={navItems} activeTab={activeTab} setActiveTab={setActiveTab} title="Customer Dashboard">
            {activeTab === 'bookings' && <div><h2 className="text-2xl font-semibold mb-4 text-slate-700">Your Booking History</h2><p className="text-gray-600">This area will display your requested, accepted, and completed services.</p></div>}
            {activeTab === 'profile' && <div><h2 className="text-2xl font-semibold mb-4 text-slate-700">Account Settings</h2><p className="text-gray-600">Manage your profile information and saved addresses.</p><p className="mt-4 font-medium">Your Role: <span className="text-blue-600">{user.role.toUpperCase()}</span></p></div>}
        </DashboardLayout>
    );
};

const ProviderDashboard = () => {
// ... (rest of ProviderDashboard component remains the same)
// ...
// ...
    const [activeTab, setActiveTab] = useState('bookings');
     const navItems = [
        { tab: 'bookings', label: 'Booking Requests' },
        { tab: 'earnings', label: 'Earnings & Payments' },
        { tab: 'profile', label: 'Profile Management' },
    ];
    return (
        <DashboardLayout navItems={navItems} activeTab={activeTab} setActiveTab={setActiveTab} title="Provider Dashboard">
            {activeTab === 'bookings' && <div><h2 className="text-2xl font-semibold mb-4 text-slate-700">Incoming Bookings & Schedule</h2><p className="text-gray-600">Accept or reject new service requests and manage your schedule here.</p></div>}
            {activeTab === 'earnings' && <div><h2 className="text-2xl font-semibold mb-4 text-slate-700">Your Payouts & Analytics</h2><p className="text-gray-600">Track your total earnings, completed jobs, and upcoming payouts.</p></div>}
            {activeTab === 'profile' && <div><h2 className="text-2xl font-semibold mb-4 text-slate-700">Update Public Profile</h2><p className="text-gray-600">Update your bio, service radius, rates, and portfolio images.</p></div>}
        </DashboardLayout>
    );
};

const AdminDashboard = () => {
// ... (rest of AdminDashboard component remains the same)
// ...
// ...
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
            if (!res.ok) throw new Error('Failed to fetch admin data. Check authorization.');
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
            if (!res.ok) throw new Error(`Failed to ${newStatus ? 'verify' : 'un-verify'} provider.`);
            
            // Re-fetch provider list to update UI
            await fetchData('providers', setProviders);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial data fetches for overview stats
        if (token) {
            fetchData('users', setUsers);
            fetchData('providers', setProviders);
            fetchData('bookings', setBookings);
        }
    }, [token, fetchData]);

    useEffect(() => {
        // Fetch data only when changing to the specific tab
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

    // Data formatting functions
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString();

    // Data for Users Table
    const userTableData = users.map(u => [
        u.id, 
        u.email, 
        <span key={u.id} className={`font-bold ${u.role === 'admin' ? 'text-red-500' : 'text-blue-500'}`}>{u.role.toUpperCase()}</span>,
        formatDate(u.created_at)
    ]);

    // Data for Providers Table
    const providerTableData = providers.map(p => [
        p.id, 
        p.display_name, 
        p.services_offered || 'N/A',
        p.review_count,
        <span key={p.id} className={`font-bold ${p.is_verified ? 'text-green-600' : 'text-yellow-600'}`}>{p.is_verified ? 'Verified' : 'Pending'}</span>,
        p.id // Placeholder for Action button rendering in AdminTable
    ]);

    // Data for Bookings Table
    const bookingTableData = bookings.map(b => [
        b.id,
        b.provider_name,
        b.customer_email,
        formatDate(b.scheduled_at),
        <span key={b.id} className={`font-bold uppercase text-xs px-2 py-1 rounded-full ${
            b.booking_status === 'closed' || b.booking_status === 'paid' ? 'bg-green-100 text-green-700' :
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

    const navigate = (pageName, data = null) => {
        setPageData(data);
        setPage(pageName);
        window.scrollTo(0, 0); // Scroll to top on page change
    };

    const renderPage = () => {
        switch (page) {
            case 'home': return <HomePage setPage={navigate} setSelectedService={setSelectedService} />;
            case 'allServices': return <AllServicesPage setPage={navigate} setSelectedService={setSelectedService} />;
            case 'serviceProviders': return <ServiceProvidersPage service={selectedService} setPage={navigate} setSelectedProvider={setSelectedProvider} />;
            case 'providerDetail': return <ProviderDetailPage provider={selectedProvider} setPage={navigate} />; 
            case 'about': return <AboutPage />;
            case 'contact': return <ContactPage />;
            case 'login': return <LoginPage setPage={navigate} />;
            case 'register': return <RegisterPage setPage={navigate} />;
            case 'forgotPassword': return <ForgotPasswordPage setPage={navigate} />; 
            case 'providerSetup': return <ProviderSetupPage setPage={navigate} pageData={pageData} />;
            case 'customerDashboard': return <CustomerDashboard />;
            case 'providerDashboard': return <ProviderDashboard />;
            case 'adminDashboard': return <AdminDashboard />;
            default: return <HomePage setPage={navigate} setSelectedService={setSelectedService} />;
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
