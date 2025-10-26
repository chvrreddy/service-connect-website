// frontend/src/pages/ServicePages.js

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ServiceCard, ProviderCard } from '../components/shared/Cards';
import { Spinner, ErrorMessage,SuccessMessage } from '../components/shared/UI';
import { BookingModal } from '../components/modals/Modals';
import { 
    API_BASE_URL, 
    CURRENCY_SYMBOL, 
    DARK_CYAN_CLASS, 
    DARK_CYAN_HOVER_CLASS,
    DARK_CYAN_TEXT_CLASS,
    getProfileField
} from './utils/helpers';

export const AllServicesPage = ({ setPage, setSelectedService, searchParams }) => {
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

export const ServiceProvidersPage = ({ service, setPage, setSelectedProvider }) => {
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

export const ProviderDetailPage = ({ provider, service, setPage }) => {
    const { isAuthenticated, user } = useAuth();
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

    const mockServiceName = service?.name || 'Service Professional';

    if (!provider) return <ErrorMessage message="No provider selected." />;
    

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

export const AboutPage = () => {
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

export const ContactPage = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // Mock details (based on .env context)
    const SUPPORT_EMAIL = 'support@serviceconnect.com'; // Placeholder, assuming a support email
    const PHONE_NUMBER = '+91 80 1234 5678'; // Placeholder
    const ADDRESS = 'Rgukt ongole '; // Placeholder
    
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