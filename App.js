import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';



// --- API Configuration ---

const API_BASE_URL = 'http://localhost:3001/api/v1';



// --- Asset Components ---

const Logo = () => (

    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block mr-2">

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



    const value = { user, token, login, logout, register, loading, isAuthenticated: !!user, fetchUserProfile };



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

        <header className="bg-white shadow-md sticky top-0 z-50">

            <nav className="container mx-auto px-6 py-3 flex justify-between items-center">

                <div onClick={() => setPage('home')} className="cursor-pointer text-2xl font-bold text-slate-800 flex items-center">

                    <Logo /> Service Connect

                </div>

                <div className="hidden md:flex items-center space-x-8">

                    <a onClick={() => setPage('home')} className="text-gray-600 hover:text-blue-600 cursor-pointer">Home</a>

                    <a onClick={() => setPage('allServices')} className="text-gray-600 hover:text-blue-600 cursor-pointer">Services</a>

                    <a onClick={() => setPage('about')} className="text-gray-600 hover:text-blue-600 cursor-pointer">About Us</a>

                    <a onClick={() => setPage('contact')} className="text-gray-600 hover:text-blue-600 cursor-pointer">Contact Us</a>

                </div>

                <div className="flex items-center space-x-4">

                    {isAuthenticated ? (

                        <>

                            <button onClick={() => setPage(getDashboardPage())} className="text-gray-700 font-medium hover:text-blue-600">Dashboard</button>

                            <button onClick={handleLogout} className="bg-slate-700 text-white px-4 py-2 rounded-md hover:bg-slate-800 transition">

                                Logout

                            </button>

                        </>

                    ) : (

                        <>

                            <button onClick={() => setPage('login')} className="text-gray-600 font-medium hover:text-blue-600">Login</button>

                            <button onClick={() => setPage('register')} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">

                                Register

                            </button>

                        </>

                    )}

                </div>

            </nav>

        </header>

    );

};



const Footer = ({ setPage }) => (

    <footer className="bg-slate-800 text-white mt-16">

        <div className="container mx-auto px-6 py-10">

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

                <div>

                    <h3 className="text-xl font-bold text-white flex items-center mb-4"><Logo /> Service Connect</h3>

                    <p className="text-gray-400">Your trusted experts at your doorstep.</p>

                </div>

                <div>

                    <h4 className="font-semibold mb-4">Quick Links</h4>

                    <ul className="space-y-2">

                        <li><a onClick={() => setPage('home')} className="text-gray-400 hover:text-white cursor-pointer">Home</a></li>

                        <li><a onClick={() => setPage('allServices')} className="text-gray-400 hover:text-white cursor-pointer">Services</a></li>

                        <li><a onClick={() => setPage('about')} className="text-gray-400 hover:text-white cursor-pointer">About Us</a></li>

                    </ul>

                </div>

                <div>

                    <h4 className="font-semibold mb-4">Support</h4>

                     <ul className="space-y-2">

                        <li><a onClick={() => setPage('contact')} className="text-gray-400 hover:text-white cursor-pointer">Contact Us</a></li>

                        <li><a className="text-gray-400 hover:text-white cursor-pointer">FAQ</a></li>

                        <li><a className="text-gray-400 hover:text-white cursor-pointer">Privacy Policy</a></li>

                    </ul>

                </div>

                 <div>

                    <h4 className="font-semibold mb-4">Connect With Us</h4>

                    <p className="text-gray-400">Follow us on social media for updates.</p>

                </div>

            </div>

            <div className="mt-8 border-t border-gray-700 pt-6 text-center text-gray-500">

                &copy; {new Date().getFullYear()} Service Connect. All Rights Reserved.

            </div>

        </div>

    </footer>

);



const ServiceCard = ({ service, onClick }) => (

    <div

        onClick={() => onClick(service)}

        className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col items-center text-center border-b-4 border-transparent hover:border-blue-500"

    >

        <div className="text-5xl mb-4">{service.icon || '💼'}</div>

        <h3 className="text-xl font-semibold text-gray-800 mb-2">{service.name}</h3>

        <p className="text-gray-600 text-sm">{service.description}</p>

    </div>

);



const ProviderCard = ({ provider, onClick }) => (

     <div onClick={() => onClick(provider)} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer flex p-4 space-x-4 border">

        <img className="w-24 h-24 rounded-full object-cover" src={`https://placehold.co/100x100/E2E8F0/4A5568?text=${provider.display_name.charAt(0)}`} alt={provider.display_name} />

        <div className="flex-grow">

            <div className="flex items-center space-x-3 mb-2">

                 <h3 className="text-lg font-bold text-gray-800">{provider.display_name}</h3>

                 {provider.is_verified && <span title="Verified Provider" className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">✔️ Verified</span>}

            </div>

            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{provider.bio}</p>

            <div className="flex items-center text-sm text-gray-500">

                <span className="text-amber-500 mr-1">⭐</span>

                <span className="font-bold text-gray-700">{parseFloat(provider.average_rating).toFixed(1)}</span>

                <span className="ml-1">({provider.review_count} reviews)</span>

            </div>

        </div>

    </div>

);



const Spinner = () => <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div></div>;

const ErrorMessage = ({ message }) => <div className="text-center text-red-600 bg-red-100 p-4 rounded-md my-4">{message}</div>;

const SuccessMessage = ({ message }) => <div className="text-center text-green-600 bg-green-100 p-4 rounded-md my-4">{message}</div>;





// --- PAGE COMPONENTS ---



const HomePage = ({ setPage, setSelectedService }) => {

    const [services, setServices] = useState([]);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState('');



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



    return (

        <main>

            <section className="bg-slate-100 py-24">

                <div className="container mx-auto px-6 text-center">

                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-4">Connect with Trusted Professionals</h1>

                    <p className="text-lg text-gray-600 mb-8">Quality service, right at your doorstep.</p>

                    <div className="max-w-3xl mx-auto bg-white p-4 rounded-lg shadow-lg flex flex-col md:flex-row gap-2">

                        <input type="text" placeholder="What service are you looking for?" className="flex-grow p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />

                        <input type="text" placeholder="Your location (e.g., City)" className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />

                        <button className="bg-blue-600 text-white font-bold px-8 py-3 rounded-md hover:bg-blue-700 transition">Search</button>

                    </div>

                </div>

            </section>



            <section className="py-16">

                <div className="container mx-auto px-6">

                    <h2 className="text-3xl font-bold text-center text-slate-800 mb-10">Popular Services</h2>

                    {loading && <Spinner />}

                    {error && <ErrorMessage message={error} />}

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">

                        {(services || []).slice(0, 8).map(service => (

                            <ServiceCard key={service.id} service={service} onClick={handleServiceClick} />

                        ))}

                    </div>

                     <div className="text-center mt-12">

                        <button onClick={() => setPage('allServices')} className="bg-slate-800 text-white font-bold px-8 py-3 rounded-md hover:bg-slate-900 transition">View All Services</button>

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

                if (!res.ok) throw new Error('Failed to fetch services');

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

    

    return (

        <div className="container mx-auto px-6 py-12">

            <h1 className="text-4xl font-bold text-slate-800 mb-10 text-center">All Our Services</h1>

            {loading && <Spinner />}

            {error && <ErrorMessage message={error} />}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">

                {(services || []).map(service => (

                    <ServiceCard key={service.id} service={service} onClick={handleServiceClick} />

                ))}

            </div>

        </div>

    );

};



const ServiceProvidersPage = ({ service, setPage, setSelectedProvider }) => {

    const [providers, setProviders] = useState([]);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState('');



    useEffect(() => {

        if (!service || !service.id) {

            setError('No service selected.');

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

    }, [service]);



    const handleProviderClick = (provider) => {

        setSelectedProvider(provider);

        setPage('providerDetail');

    };



    return (

        <div className="container mx-auto px-6 py-12">

            <button onClick={() => setPage('allServices')} className="text-blue-600 hover:underline mb-6">&larr; Back to all services</button>

            <h1 className="text-4xl font-bold text-slate-800 mb-2">{service?.name || "Providers"}</h1>

            <p className="text-lg text-gray-600 mb-8">{service?.description}</p>

            {loading && <Spinner />}

            {error && <ErrorMessage message={error} />}

            <div className="space-y-6">

                {!loading && providers.length > 0 ? (

                    providers.map(provider => (

                        <ProviderCard key={provider.provider_id} provider={provider} onClick={handleProviderClick} />

                    ))

                ) : (

                    !loading && <p className="text-center text-gray-500 bg-gray-100 p-8 rounded-lg">No providers found for this service yet.</p>

                )}

            </div>

        </div>

    );

};



const AboutPage = () => (

    <div className="bg-white">

        <div className="container mx-auto px-6 py-20">

            <div className="text-center">

                <h1 className="text-4xl font-extrabold text-slate-800 mb-4">About Service Connect</h1>

                <p className="text-lg text-gray-600 max-w-3xl mx-auto">

                    Connecting communities with reliable local professionals.

                </p>

            </div>



            <div className="mt-16 grid md:grid-cols-2 gap-12 items-center">

                <div>

                    <h2 className="text-3xl font-bold text-slate-700 mb-4">Our Mission</h2>

                    <p className="text-gray-700 leading-relaxed mb-4">

                        To seamlessly connect customers with skilled, reliable, and verified local service professionals. We believe that finding the right expert for your home or business needs should be easy, transparent, and trustworthy.

                    </p>

                    <h2 className="text-3xl font-bold text-slate-700 mb-4 mt-8">Our Vision</h2>

                    <p className="text-gray-700 leading-relaxed">

                        To become the most trusted platform for home and business services, empowering local economies and helping professionals grow their businesses while providing unparalleled convenience and peace of mind to our customers.

                    </p>

                </div>

                 <div>

                    <img src="https://placehold.co/600x400/E0E7FF/4338CA?text=Our+Team" alt="Service Connect Team" className="rounded-lg shadow-lg"/>

                </div>

            </div>

             <div className="mt-20">

                <h2 className="text-3xl font-bold text-center text-slate-800 mb-10">Why Choose Us?</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">

                    <div className="bg-slate-50 p-8 rounded-lg">

                        <h3 className="text-xl font-semibold text-slate-800 mb-2">Verified Experts</h3>

                        <p className="text-gray-600">Every professional on our platform is vetted for skill, experience, and reliability.</p>

                    </div>

                    <div className="bg-slate-50 p-8 rounded-lg">

                        <h3 className="text-xl font-semibold text-slate-800 mb-2">Transparent Pricing</h3>

                        <p className="text-gray-600">No hidden fees. Get clear pricing upfront before you book a service.</p>

                    </div>

                     <div className="bg-slate-50 p-8 rounded-lg">

                        <h3 className="text-xl font-semibold text-slate-800 mb-2">Seamless Booking</h3>

                        <p className="text-gray-600">Find, book, and pay for services in just a few clicks through our secure platform.</p>

                    </div>

                </div>

            </div>

        </div>

    </div>

);





const ContactPage = () => (

     <div className="container mx-auto px-6 py-16">

        <h1 className="text-4xl font-bold text-slate-800 mb-6 text-center">Contact Us</h1>

        <p className="text-lg text-gray-700 max-w-3xl mx-auto text-center mb-10">Have a question or need support? Fill out the form below and we'll get back to you.</p>

        <form className="max-w-xl mx-auto bg-white p-8 rounded-lg shadow-md">

            <div className="space-y-6">

                <div>

                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>

                    <input type="text" id="name" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" required />

                </div>

                <div>

                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>

                    <input type="email" id="email" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" required />

                </div>

                <div>

                    <label htmlFor="message" className="block text-sm font-medium text-gray-700">Message</label>

                    <textarea id="message" rows="4" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" required></textarea>

                </div>

                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-md hover:bg-blue-700 transition">Send Message</button>

            </div>

        </form>

    </div>

);





const AuthFormContainer = ({ children, title }) => (

    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">

        <div className="sm:mx-auto sm:w-full sm:max-w-md">

            <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-800">{title}</h2>

        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">

            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">

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

        <AuthFormContainer title="Sign in to your account">

            <form className="space-y-6" onSubmit={handleSubmit}>

                <div>

                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>

                    <input id="email" name="email" type="email" required className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>

                </div>

                <div>

                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>

                    <input id="password" name="password" type="password" required className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>

                </div>

                {error && <ErrorMessage message={error}/>}

                <div className="text-sm text-right">

                    <a onClick={() => setPage('forgotPassword')} className="font-medium text-blue-600 hover:text-blue-500 cursor-pointer">Forgot your password?</a>

                </div>

                <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Sign in</button>

            </form>

             <div className="mt-6 text-center text-sm">

                Don't have an account? <a onClick={() => setPage('register')} className="font-medium text-blue-600 hover:text-blue-500 cursor-pointer">Register here</a>

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

            }

        } else {

            setError(result.message || "Registration failed.");

        }

    };



    return (

        <AuthFormContainer title="Create an account">

             <form className="space-y-6" onSubmit={handleSubmit}>

                <div>

                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">I am a...</label>

                    <select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value)} required className="mt-1 block w-full pl-3 pr-10 py-2 border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">

                        <option value="customer">Customer</option>

                        <option value="provider">Service Provider</option>

                    </select>

                </div>

                {role === 'provider' && services.length > 0 && (

                     <div>

                        <label htmlFor="service" className="block text-sm font-medium text-gray-700">Primary Service</label>

                        <select id="service" name="service" value={primaryService} onChange={e => setPrimaryService(e.target.value)} required className="mt-1 block w-full pl-3 pr-10 py-2 border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">

                            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}

                        </select>

                    </div>

                )}

                <div>

                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>

                    <input id="email" name="email" type="email" required className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>

                </div>

                <div>

                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>

                    <input id="password" name="password" type="password" required className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>

                </div>

                {error && <ErrorMessage message={error}/>}

                {success && <SuccessMessage message={success}/>}

                <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Create Account</button>

            </form>

             <div className="mt-6 text-center text-sm">

                Already have an account? <a onClick={() => setPage('login')} className="font-medium text-blue-600 hover:text-blue-500 cursor-pointer">Sign in</a>

            </div>

        </AuthFormContainer>

    );

};



const ForgotPasswordPage = ({ setPage }) => {

    const [step, setStep] = useState(1);

    const [message, setMessage] = useState('');



    const handleEmailSubmit = (e) => {

        e.preventDefault();

        setMessage('A password reset OTP has been sent to your email.');

        setStep(2);

    };



    const handleOtpSubmit = (e) => {

        e.preventDefault();

        setMessage('Your password has been successfully reset. Please login.');

        setTimeout(() => setPage('login'), 2000);

    };

    

    if (step === 2) {

        return (

            <AuthFormContainer title="Enter Reset Code">

                <form className="space-y-6" onSubmit={handleOtpSubmit}>

                     <div>

                        <label htmlFor="otp" className="block text-sm font-medium text-gray-700">6-Digit OTP</label>

                        <input id="otp" name="otp" type="text" maxLength="6" required className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>

                    </div>

                     <div>

                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">New Password</label>

                        <input id="newPassword" name="newPassword" type="password" required className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>

                    </div>

                    {message && <SuccessMessage message={message}/>}

                    <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Reset Password</button>

                </form>

            </AuthFormContainer>

        );

    }



    return (

        <AuthFormContainer title="Reset your password">

            <form className="space-y-6" onSubmit={handleEmailSubmit}>

                <div>

                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>

                    <input id="email" name="email" type="email" required className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>

                </div>

                {message && <SuccessMessage message={message} />}

                <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Send Reset Code</button>

            </form>

            <div className="mt-6 text-center text-sm">

                Remember your password? <a onClick={() => setPage('login')} className="font-medium text-blue-600 hover:text-blue-500 cursor-pointer">Sign in</a>

            </div>

        </AuthFormContainer>

    );

};



const ProviderSetupPage = ({ setPage, pageData }) => {

    const { token } = useAuth();

    const [error, setError] = useState('');

    const [success, setSuccess] = useState('');



    const handleSubmit = async (e) => {

        e.preventDefault();

        setError(''); setSuccess('');



        const profileData = {

            display_name: e.target.display_name.value,

            bio: e.target.bio.value,

            location_lat: parseFloat(e.target.lat.value) || 0,

            location_lon: parseFloat(e.target.lon.value) || 0,

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

            if (response.ok) {

                setSuccess('Profile setup complete! Redirecting to your dashboard...');

                setTimeout(() => setPage('providerDashboard'), 2000);

            } else {

                setError(data.error || 'Failed to set up profile.');

            }

        } catch (err) {

            setError('A network error occurred.');

        }

    };



    return (

        <AuthFormContainer title="Set Up Your Provider Profile">

            <p className="text-center text-sm text-gray-600 mb-4">Complete these details to get started.</p>

            <form className="space-y-4" onSubmit={handleSubmit}>

                <div>

                    <label htmlFor="display_name" className="block text-sm font-medium text-gray-700">Display Name</label>

                    <input id="display_name" name="display_name" type="text" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />

                </div>

                <div>

                    <label htmlFor="bio" className="block text-sm font-medium text-gray-700">Short Bio</label>

                    <textarea id="bio" name="bio" rows="3" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Describe your services and experience..."></textarea>

                </div>

                <div className="grid grid-cols-2 gap-4">

                     <div>

                        <label htmlFor="lat" className="block text-sm font-medium text-gray-700">Latitude</label>

                        <input id="lat" name="lat" type="number" step="any" placeholder="e.g., 12.9716" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />

                    </div>

                     <div>

                        <label htmlFor="lon" className="block text-sm font-medium text-gray-700">Longitude</label>

                        <input id="lon" name="lon" type="number" step="any" placeholder="e.g., 77.5946" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />

                    </div>

                </div>

                 <div>

                    <label htmlFor="radius" className="block text-sm font-medium text-gray-700">Service Radius (km)</label>

                    <input id="radius" name="radius" type="number" defaultValue="10" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />

                </div>

                {error && <ErrorMessage message={error}/>}

                {success && <SuccessMessage message={success}/>}

                <button type="submit" className="w-full flex justify-center py-2 px-4 rounded-md font-medium text-white bg-blue-600 hover:bg-blue-700">Complete Setup</button>

            </form>

        </AuthFormContainer>

    );

};





// --- Dashboard Pages ---

const DashboardLayout = ({ children, navItems, activeTab, setActiveTab, title }) => (

    <div className="bg-slate-50 min-h-screen">

        <div className="container mx-auto px-6 py-8">

            <h1 className="text-3xl font-bold text-slate-800 mb-6">{title}</h1>

            <div className="flex flex-col md:flex-row gap-8">

                <aside className="md:w-1/4">

                    <nav className="bg-white rounded-lg shadow p-4">

                        <ul>

                           {navItems.map(item => (

                               <li key={item.tab}>

                                    <a

                                        onClick={() => setActiveTab(item.tab)}

                                        className={`block px-4 py-2 rounded-md cursor-pointer transition-colors ${activeTab === item.tab ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}

                                    >

                                        {item.label}

                                    </a>

                                </li>

                           ))}

                        </ul>

                    </nav>

                </aside>

                <main className="md:w-3/4">

                    <div className="bg-white rounded-lg shadow p-6 min-h-[400px]">

                        {children}

                    </div>

                </main>

            </div>

        </div>

    </div>

);



const CustomerDashboard = () => {

    const [activeTab, setActiveTab] = useState('bookings');

    const { user } = useAuth();

    const navItems = [

        { tab: 'bookings', label: 'My Bookings' },

        { tab: 'profile', label: 'My Profile' },

    ];

    return (

        <DashboardLayout navItems={navItems} activeTab={activeTab} setActiveTab={setActiveTab} title="Customer Dashboard">

            {activeTab === 'bookings' && <div><h2 className="text-2xl font-semibold mb-4">Your Bookings</h2><p>Your booking history will appear here.</p></div>}

            {activeTab === 'profile' && <div><h2 className="text-2xl font-semibold mb-4">Profile Settings</h2><p>Welcome, {user.email}.</p></div>}

        </DashboardLayout>

    );

};

const ProviderDashboard = () => {

    const [activeTab, setActiveTab] = useState('bookings');

     const navItems = [

        { tab: 'bookings', label: 'Booking Requests' },

        { tab: 'earnings', label: 'Earnings' },

        { tab: 'profile', label: 'Profile Settings' },

    ];

    return (

        <DashboardLayout navItems={navItems} activeTab={activeTab} setActiveTab={setActiveTab} title="Provider Dashboard">

            {activeTab === 'bookings' && <div><h2 className="text-2xl font-semibold mb-4">Incoming Bookings</h2><p>New booking requests will appear here.</p></div>}

            {activeTab === 'earnings' && <div><h2 className="text-2xl font-semibold mb-4">Your Earnings</h2><p>A summary of your payments will be shown here.</p></div>}

            {activeTab === 'profile' && <div><h2 className="text-2xl font-semibold mb-4">Edit Your Profile</h2><p>Update your bio, services, and location here.</p></div>}

        </DashboardLayout>

    );

};

const AdminDashboard = () => {

    const [activeTab, setActiveTab] = useState('overview');

    const navItems = [

        { tab: 'overview', label: 'Overview' },

        { tab: 'users', label: 'Manage Users' },

        { tab: 'providers', label: 'Manage Providers' },

        { tab: 'bookings', label: 'All Bookings' },

    ];

    // Mock data for admin panel

    const mockUsers = [ {id: 1, email: 'customer@test.com', role: 'customer'}, {id: 2, email: 'provider@test.com', role: 'provider'} ];

    const mockProviders = [ {id: 1, name: 'Rajesh Sharma', service: 'Electrician', verified: true}, {id: 2, name: 'Sunita Devi', service: 'Carpenter', verified: false} ];



    const handleVerify = (providerId) => {

        alert(`Verification status toggled for provider ${providerId}. (This is a demo)`);

    };



    return (

        <DashboardLayout navItems={navItems} activeTab={activeTab} setActiveTab={setActiveTab} title="Admin Dashboard">

            {activeTab === 'overview' && <div><h2 className="text-2xl font-semibold mb-4">Platform Overview</h2><p>Key metrics and statistics will be displayed here.</p></div>}

            {activeTab === 'users' && <AdminTable title="All Users" headers={['ID', 'Email', 'Role']} data={mockUsers.map(u => [u.id, u.email, u.role])} />}

            {activeTab === 'providers' && <AdminTable title="All Providers" headers={['ID', 'Name', 'Service', 'Status', 'Actions']} data={mockProviders.map(p => [p.id, p.name, p.service, p.verified ? 'Verified' : 'Pending', <button key={`verify-${p.id}`} onClick={() => handleVerify(p.id)} className={`px-2 py-1 text-xs rounded ${p.verified ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white'}`}>{p.verified ? 'Un-verify' : 'Verify'}</button> ])} />}

            {activeTab === 'bookings' && <div><h2 className="text-2xl font-semibold mb-4">All Platform Bookings</h2><p>A list of all bookings will be shown here.</p></div>}

        </DashboardLayout>

    );

};



const AdminTable = ({ title, headers, data }) => (

    <div>

        <h2 className="text-2xl font-semibold text-gray-800 mb-4">{title}</h2>

        <div className="overflow-x-auto">

            <table className="min-w-full bg-white">

                <thead className="bg-gray-100">

                    <tr>

                        {headers.map(header => <th key={header} className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>)}

                    </tr>

                </thead>

                <tbody className="text-gray-600 text-sm font-light">

                    {data.map((row, index) => (

                        <tr key={index} className="border-b border-gray-200 hover:bg-gray-100">

                            {row.map((cell, cellIndex) => <td key={cellIndex} className="py-3 px-6 text-left whitespace-nowrap">{cell}</td>)}

                        </tr>

                    ))}

                </tbody>

            </table>

        </div>

    </div>

);





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

            case 'providerDetail': return <div>Provider Detail Page (WIP)</div>;

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

            <div className="flex flex-col min-h-screen font-sans bg-slate-50">

                <Header setPage={navigate} />

                <main className="flex-grow">

                    {renderPage()}

                </main>

                <Footer setPage={navigate} />

            </div>

        </AuthProvider>

    );

}