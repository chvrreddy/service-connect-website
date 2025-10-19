import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
    API_BASE_URL, 
    CURRENCY_SYMBOL, 
    // DARK_CYAN_CLASS removed (was unused)
    // DARK_CYAN_HOVER_CLASS removed (was unused)
    DARK_CYAN_TEXT_CLASS,
    getPhotoUrl 
} from '../utils/helpers';
import { Spinner, ErrorMessage, SuccessMessage } from '../../components/shared/UI';
import { DashboardLayout } from '../../components/shared/UI';
import { BookingCard } from '../../components/shared/Cards';
import { 
    SetPriceModal, 
    ChatComponent 
} from '../../components/modals/Modals';


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
  const { user, token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    if (user?.role !== 'provider') {
      setError('Only providers can access this page.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

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
  }, [token, user?.role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) setProfilePhotoFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const formData = new FormData(e.target);
    const serviceIds = formData.get('primary_service_id')
      ? [formData.get('primary_service_id')]
      : [];

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
      payout_upi_id: formData.get('payout_upi_id'),
    };

    try {
      // 1️⃣ Update text profile details
      let response = await fetch(`${API_BASE_URL}/provider/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify(profileData),
      });

      let data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update basic profile.');

      // 2️⃣ Upload photo if selected
      if (profilePhotoFile) {
        const photoFormData = new FormData();
        photoFormData.append('profile_photo', profilePhotoFile);

        response = await fetch(`${API_BASE_URL}/user/profile-photo`, {
          method: 'POST',
          headers: { 'x-auth-token': token },
          body: photoFormData,
        });

        data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to upload profile photo.');
      }

      setSuccess('Profile updated successfully!');
      setProfilePhotoFile(null);
      await fetchData(); // Refresh profile data

    } catch (err) {
      setError(err.message || 'A network error occurred while updating the profile.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spinner />;
  if (error && !profile) return <ErrorMessage message={error} />;
  if (!profile)
    return (
      <ErrorMessage message="Provider profile data is missing. Please complete your setup or contact support." />
    );

  const currentServiceId =
    profile.service_ids && profile.service_ids.length > 0
      ? profile.service_ids[0]
      : services[0]?.id || '';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-700">Manage Your Public Profile</h2>

      {error && <ErrorMessage message={error} />}
      {success && <SuccessMessage message={success} />}

      <form onSubmit={handleSubmit} className="space-y-6 bg-gray-50 p-6 rounded-xl border">

        {/* Profile Picture */}
        <h3 className={`text-lg font-semibold ${DARK_CYAN_TEXT_CLASS} border-b pb-2`}>
          Profile Picture
        </h3>
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
              className="text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full 
              file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 
              hover:file:bg-cyan-100"
              disabled={loading}
            />
            {profilePhotoFile && (
              <p className="text-sm text-green-600 mt-1">
                Ready to upload: {profilePhotoFile.name}
              </p>
            )}
          </div>
        </div>

        {/* Basic Details */}
        <h3 className={`text-lg font-semibold ${DARK_CYAN_TEXT_CLASS} border-b pb-2`}>
          Basic Details
        </h3>
        <div>
          <label htmlFor="display_name" className="block text-sm font-semibold text-gray-700">
            Display Name
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            defaultValue={profile.display_name}
            required
            className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label htmlFor="primary_service_id" className="block text-sm font-semibold text-gray-700">
            Primary Service Category
          </label>
          <select
            id="primary_service_id"
            name="primary_service_id"
            defaultValue={currentServiceId}
            required
            className="mt-1 block w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="bio" className="block text-sm font-semibold text-gray-700">
            Short Bio / Expertise Summary
          </label>
          <textarea
            id="bio"
            name="bio"
            rows="4"
            defaultValue={profile.bio}
            required
            className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg"
            placeholder="Describe your services and experience (Max 250 chars)..."
          ></textarea>
        </div>

        {/* Service Area */}
        <h3 className={`text-lg font-semibold ${DARK_CYAN_TEXT_CLASS} border-b pb-2`}>
          Service Area
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="location_lat" className="block text-sm font-semibold text-gray-700">
              Location Latitude
            </label>
            <input
              id="location_lat"
              name="location_lat"
              type="number"
              step="any"
              defaultValue={profile.location_lat}
              required
              className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="location_lon" className="block text-sm font-semibold text-gray-700">
              Location Longitude
            </label>
            <input
              id="location_lon"
              name="location_lon"
              type="number"
              step="any"
              defaultValue={profile.location_lon}
              required
              className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="service_radius_km" className="block text-sm font-semibold text-gray-700">
              Service Radius (km)
            </label>
            <input
              id="service_radius_km"
              name="service_radius_km"
              type="number"
              defaultValue={profile.service_radius_km}
              required
              className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        {/* Payout Details */}
        <h3 className={`text-lg font-semibold ${DARK_CYAN_TEXT_CLASS} border-b pb-2`}>
          Payout Details
        </h3>
        <div>
          <label htmlFor="payout_upi_id" className="block text-sm font-semibold text-gray-700">
            Primary Payout UPI ID / Bank Details
          </label>
          <input
            id="payout_upi_id"
            name="payout_upi_id"
            type="text"
            defaultValue={profile.payout_upi_id}
            required
            className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg"
            placeholder="E.g., yourname@bank or A/C: 1234"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 
          transition shadow-md disabled:bg-gray-400"
        >
          {loading ? 'Saving Profile...' : 'Save Profile Updates'}
        </button>
      </form>
    </div>
  );
};


export const ProviderDashboard = () => {
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
