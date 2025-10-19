// frontend/src/pages/dashboards/AdminDashboard.js

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
    API_BASE_URL, 
    CURRENCY_SYMBOL, 
    DARK_CYAN_CLASS, 
    DARK_CYAN_HOVER_CLASS,
    DARK_CYAN_TEXT_CLASS,
    getPhotoUrl 
} from '../utils/helpers';
import { Spinner, ErrorMessage, SuccessMessage } from '../../components/shared/UI';
import { DashboardLayout } from '../../components/shared/UI';


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


export const AdminDashboard = () => {
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