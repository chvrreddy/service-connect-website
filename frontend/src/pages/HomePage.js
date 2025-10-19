// frontend/src/pages/HomePage.js

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ServiceCard, ProviderCard } from '../components/shared/Cards';
import { Spinner, ErrorMessage, HowItWorksCard } from '../components/shared/UI';
import { 
    API_BASE_URL, 
    DARK_CYAN_CLASS, 
    DARK_CYAN_HOVER_CLASS,
    getProfileField 
} from './utils/helpers';

export const HomePage = ({ setPage, setSelectedService, setSearchParams, setSelectedProvider }) => {
  const [services, setServices] = useState([]);
  const [topProviders, setTopProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const { user, isAuthenticated } = useAuth(); 

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
          `${API_BASE_URL}/providers?lat=${defaultLat}&lon=${defaultLon}&sort_by=top_rated`
        );
        if (!providersRes.ok) console.warn("Failed to fetch top providers.");
        const providersData = await providersRes.json();
        setTopProviders(providersData.providers || []);
        
        // 3. Initialize search location if user has saved one
        const userAddress = getProfileField(user, 'address_line_1', '');
        const userCity = getProfileField(user, 'city', '');
        if (isAuthenticated && userAddress && userCity) {
            setSearchLocation(`${userAddress}, ${userCity}`);
        } else if (isAuthenticated && defaultLat !== 0 && defaultLon !== 0) {
            setSearchLocation(`${defaultLat}, ${defaultLon}`);
        } else {
            setSearchLocation(''); // Clear if using mock location
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
    // For now, only extract location if it looks like lat, lon
    const parts = searchLocation.split(",").map((s) => s.trim());
    let lat = null;
    let lon = null;
    
    // Simple check to see if we have coordinates
    if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
        lat = parseFloat(parts[0]);
        lon = parseFloat(parts[1]);
    }
    
    setSearchParams({
      query: searchQuery,
      lat: lat,
      lon: lon,
    });
    setPage("allServices");
  };

  const handleProviderClick = (provider) => {
    // Find the full service object associated with the provider's service_id
    const service = services.find(s => s.id === provider.service_id) || null;
    setSelectedService(service);
    setSelectedProvider(provider);
    setPage("providerDetail");
  };

  return (
    <main>
      {/* HERO SECTION */}
      <section className={`${DARK_CYAN_CLASS} pt-0 pb-16 relative overflow-hidden`}>
        {/* Full-width Background Image */}
        <div className="absolute inset-0 w-full h-[450px]">
            <img
                src="/home_image.jpg"
                alt="Trusted experts team graphic"
                className="w-full h-full object-cover object-center brightness-110"
            />
            <div className="absolute inset-0 bg-black/10"></div>
        </div>

        {/* Text & Search Overlay */}
        <div className="relative z-10 flex flex-col items-center justify-end text-center h-[450px] pt-0 pb-20 px-6">
            
            {/* Search Bar */}
            <div className="bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-lg flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-2 max-w-3xl w-full">
                {/* Service Input */}
                <input
                    type="text"
                    placeholder="What service are you looking for?"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-grow p-2 rounded-lg text-base focus:outline-none border border-gray-200 focus:ring-2 focus:ring-blue-400 transition-all duration-200"
                />
                {/* Location Input */}
                <div className="relative flex items-center w-full md:w-auto">
                    <span className="absolute left-3 text-gray-400">📍</span>
                    <input
                        type="text"
                        placeholder="Your Location (e.g., Lat, Lon or Address)"
                        value={searchLocation}
                        onChange={(e) => setSearchLocation(e.target.value)}
                        className="pl-8 p-2 rounded-lg text-base w-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200"
                    />
                </div>
                {/* Search Button */}
                <button
                    onClick={handleSearch}
                    className={`${DARK_CYAN_CLASS} text-white font-bold px-6 py-2 rounded-xl ${DARK_CYAN_HOVER_CLASS} transition-all duration-200 w-full md:w-auto text-base shadow-md`}
                >
                    Search
                </button>
            </div>
        </div>
      </section>
      
      {/* POPULAR SERVICES SECTION */}
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
                  // Mock icons for display
                  icon: index === 0 ? "🔧" : index === 1 ? "💡" : index === 2 ? "🔨" : "🛠️",
                }}
                onClick={handleServiceClick}
              />
            ))}
          </div>
        </div>
      </section>
      
      {/* TOP RATED PROVIDERS SECTION */}
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

      {/* HOW IT WORKS SECTION */}
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