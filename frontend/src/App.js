// frontend/src/App.js

import React, { useState } from 'react';

// --- Context ---
import { AuthProvider, useAuth } from './context/AuthContext';

// --- Shared UI Components ---
// All UI components (Header, Footer, Spinner) use NAMED EXPORTS
import { Header, Footer, Spinner } from './components/shared/UI';

// --- Auth Forms ---
// All auth components use NAMED EXPORTS
import { 
    LoginPage, 
    RegisterPage, 
    ForgotPasswordPage, 
    ProviderSetupPage 
} from './components/auth/AuthForms';

// --- Feature Pages ---
// All pages use NAMED EXPORTS
import { HomePage } from './pages/HomePage';
import { 
    AllServicesPage, 
    ServiceProvidersPage, 
    ProviderDetailPage, 
    AboutPage, 
    ContactPage 
} from './pages/ServicePages';

// --- Dashboard Pages ---
// All dashboard components use NAMED EXPORTS
import { CustomerDashboard } from './pages/dashboards/CustomerDashboard';
import { ProviderDashboard } from './pages/dashboards/ProviderDashboard';
import { AdminDashboard } from './pages/dashboards/AdminDashboard';


const AppContent = () => {
    // pageData is used to pass initial state/props for transitions (e.g., primaryServiceId after registration)
    const [page, setPage] = useState('home');
    const [pageData, setPageData] = useState(null);
    const [selectedService, setSelectedService] = useState(null);
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [searchParams, setSearchParams] = useState(null); 
    
    // Auth context hook
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
            case 'home': 
                return <HomePage 
                    setPage={navigate} 
                    setSelectedService={setSelectedService} 
                    setSearchParams={setSearchParams} 
                    setSelectedProvider={setSelectedProvider} 
                />;
            case 'allServices': 
                return <AllServicesPage 
                    setPage={navigate} 
                    setSelectedService={setSelectedService} 
                    searchParams={searchParams} 
                />;
            case 'serviceProviders': 
                return <ServiceProvidersPage 
                    service={selectedService} 
                    setPage={navigate} 
                    setSelectedProvider={setSelectedProvider} 
                />;
            case 'providerDetail': 
                return <ProviderDetailPage 
                    provider={selectedProvider} 
                    service={selectedService} 
                    setPage={navigate} 
                />; 
            case 'about': 
                return <AboutPage />;
            case 'contact': 
                return <ContactPage />;
            case 'login': 
                return <LoginPage setPage={navigate} />;
            case 'register': 
                return <RegisterPage setPage={navigate} />;
            case 'forgotPassword': 
                return <ForgotPasswordPage setPage={navigate} />; 
            case 'providerSetup': 
                return <ProviderSetupPage setPage={navigate} pageData={pageData} />;
            case 'customerDashboard': 
                return <CustomerDashboard setPage={navigate} />; 
            case 'providerDashboard': 
                return <ProviderDashboard />;
            case 'adminDashboard': 
                return <AdminDashboard />;
            default: 
                return <HomePage 
                    setPage={navigate} 
                    setSelectedService={setSelectedService} 
                    setSearchParams={setSearchParams} 
                    setSelectedProvider={setSelectedProvider} 
                />;
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
