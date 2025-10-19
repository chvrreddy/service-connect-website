// frontend/src/pages/dashboards/CustomerDashboard.js

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
    API_BASE_URL, 
    CURRENCY_SYMBOL, 
    DARK_CYAN_CLASS, 
    DARK_CYAN_HOVER_CLASS,
    DARK_CYAN_TEXT_CLASS,
    MOCK_UPI_QR_CODE_URL,
    getProfileField,
    getPhotoUrl
} from '../utils/helpers';
import { Spinner, ErrorMessage, SuccessMessage } from '../../components/shared/UI';
import { DashboardLayout } from '../../components/shared/UI';
import { BookingCard } from '../../components/shared/Cards';
import { 
    ReviewAndPaymentModal, 
    PriceConfirmationModal, 
    ChatComponent 
} from '../../components/modals/Modals';


const CustomerProfileManagement = () => {
    const { user, token, fetchUserProfile } = useAuth();
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

const CustomerWallet = () => {
    const { token } = useAuth();
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


export const CustomerDashboard = ({ setPage }) => {
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