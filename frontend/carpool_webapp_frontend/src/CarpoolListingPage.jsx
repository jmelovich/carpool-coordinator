import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Cookies from 'js-cookie';
import RouteMap, { RouteMapModal } from './components/RouteMap';

function CarpoolListingPage() {
  const [username, setUsername] = useState('');
  const [carpoolData, setCarpoolData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPublicView, setIsPublicView] = useState(false);
  const [userRole, setUserRole] = useState({ isDriver: false, isPassenger: false });
  const [actionLoading, setActionLoading] = useState(false);
  const [showRouteMap, setShowRouteMap] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const carpoolId = searchParams.get('carpool_id');

  // Fetch user's role in this carpool
  const fetchUserRole = async () => {
    if (!carpoolId) return;
    
    const accessToken = Cookies.get('access_token');
    if (!accessToken) {
      navigate('/');
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:5000/api/carpool/user-role?carpool_id=${carpoolId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserRole({
          isDriver: data.is_driver,
          isPassenger: data.is_passenger
        });
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  };

  useEffect(() => {
    const fetchUserInfo = async () => {
      const accessToken = Cookies.get('access_token');
      if (!accessToken) {
        navigate('/'); // Redirect to login if no token
        return;
      }

      try {
        const response = await fetch('http://127.0.0.1:5000/api/users/me', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch user information');
          Cookies.remove('access_token');
          navigate('/');
          return;
        }

        const data = await response.json();
        setUsername(data.user.username);
      } catch (error) {
        console.error('Error fetching user info:', error);
        setError('Failed to load user information');
        Cookies.remove('access_token');
        navigate('/');
      }
    };

    fetchUserInfo();
  }, [navigate]);

  const fetchCarpoolData = async () => {
    if (!carpoolId) {
      setError('No carpool ID provided');
      setLoading(false);
      return;
    }

    const accessToken = Cookies.get('access_token');
    if (!accessToken) {
      navigate('/');
      return;
    }

    try {
      setLoading(true);
      
      // First try to get the full listing (as owner)
      const fullResponse = await fetch(`http://127.0.0.1:5000/api/carpool/get-full-listing?carpool_id=${carpoolId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (fullResponse.ok) {
        const data = await fullResponse.json();
        setCarpoolData(data.carpool);
        setIsPublicView(false);
        setLoading(false);
        return;
      }
      
      // If that fails, try to get the public listing
      const publicResponse = await fetch(`http://127.0.0.1:5000/api/carpool/get-public-listing?carpool_id=${carpoolId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (publicResponse.ok) {
        const data = await publicResponse.json();
        setCarpoolData(data.carpool);
        setIsPublicView(true);
        setLoading(false);
        return;
      }
      
      // If both fail, show error and set carpoolData to null explicitly
      setError('Carpool not found or you don\'t have permission to view it');
      setCarpoolData(null);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching carpool data:', error);
      setError('An error occurred while loading carpool data');
      setCarpoolData(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    // When carpoolId changes, fetch both carpool data and user's role
    if (carpoolId) {
      fetchCarpoolData();
      fetchUserRole();
    }
  }, [carpoolId, navigate]);

  const handleLogout = () => {
    Cookies.remove('access_token');
    navigate('/');
  };

  const handleGoHome = () => {
    navigate('/home');
  };

  const handleGoBack = () => {
    navigate('/carpool');
  };

  // Handle passenger leaving or being kicked from carpool
  const handleRemovePassenger = async (passengerId = null) => {
    // If no passengerId provided, the user is removing themselves
    const isLeaving = !passengerId;
    
    // Show confirmation dialog
    const message = isLeaving 
      ? 'Are you sure you want to leave this carpool?' 
      : `Are you sure you want to remove this passenger from the carpool?`;
      
    if (!window.confirm(message)) {
      return; // User canceled
    }
    
    setActionLoading(true);
    setError('');
    
    try {
      const accessToken = Cookies.get('access_token');
      if (!accessToken) {
        navigate('/');
        return;
      }
      
      // Prepare request data
      const requestData = {
        carpool_id: carpoolId
      };
      
      // If passengerId is provided, it means the driver is kicking someone
      if (passengerId) {
        requestData.passenger_id = passengerId;
      }
      
      // Call the API
      const response = await fetch('http://127.0.0.1:5000/api/carpool/remove-passenger', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.message || 'Failed to remove passenger');
        return;
      }
      
      // If the user left the carpool, redirect to carpool search page
      if (isLeaving) {
        alert('You have successfully left the carpool');
        navigate('/carpool');
        return;
      }
      
      // Otherwise, update the carpool data and show success message
      setCarpoolData(data.carpool);
      alert('Passenger removed successfully');
      
      // Refresh user role in case the passenger was the current user
      fetchUserRole();
      
    } catch (error) {
      console.error('Error removing passenger:', error);
      setError('An error occurred while removing passenger');
    } finally {
      setActionLoading(false);
    }
  };

  // Format address from JSON string or object
  const formatAddress = (address) => {
    if (!address) return "Not specified";
    
    try {
      // If it's a string that looks like JSON, parse it
      const addressObj = typeof address === 'string' && address.includes('{') 
        ? JSON.parse(address) 
        : address;
      
      // Check if it's already an object with the expected properties
      if (typeof addressObj === 'object') {
        const parts = [];
        
        if (addressObj.street) parts.push(addressObj.street);
        if (addressObj.city) parts.push(addressObj.city);
        if (addressObj.state) parts.push(addressObj.state);
        if (addressObj.zip) parts.push(addressObj.zip);
        
        return parts.join(', ');
      }
      
      // If none of the above worked, just return the original
      return address;
    } catch (e) {
      // If parsing fails, return the original string
      return address;
    }
  };

  // Format date and time from string
  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return "Not specified";
    
    try {
      // Handle combined date-time format with semicolon
      if (dateTimeStr.includes(';')) {
        const [datePart, timePart] = dateTimeStr.split(';');
        // Convert from MM-DD-YYYY format to a more readable format
        const [month, day, year] = datePart.split('-');
        return `${month}/${day}/${year} at ${timePart}`;
      }
      
      // If it's just a time
      return dateTimeStr;
    } catch (e) {
      return dateTimeStr;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white shadow-md py-4 px-6 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center space-x-4">
           <h1 className="text-xl font-semibold text-[#2A9D8F]">Carpool Details</h1>
           <span className="text-gray-600">Welcome, {username || '...'}</span>
           {isPublicView && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm"> -- Public View</span>}
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleGoBack}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
          >
            Back
          </button>
          <button
            onClick={handleGoHome}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
          >
            Home
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {error && (
          <div className="bg-red-100 text-red-800 p-4 mb-4 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-10">
            <p className="text-gray-600 text-lg">Loading carpool information...</p>
          </div>
        ) : carpoolData ? (
          <div className="space-y-6">
            {/* Carpool Header */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-[#264653] mb-2">
                    Carpool #{carpoolData.carpool_id}
                  </h2>
                  <p className="text-gray-600">Created on {new Date(carpoolData.created_at).toLocaleDateString()}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {carpoolData.capacity.current}/{carpoolData.capacity.max} Passengers
                  </p>
                </div>
              </div>
              
              {/* Show Leave Carpool button if user is a passenger */}
              {userRole.isPassenger && (
                <div className="mt-4">
                  <button
                    onClick={() => handleRemovePassenger()}
                    disabled={actionLoading}
                    className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? 'Processing...' : 'Leave Carpool'}
                  </button>
                </div>
              )}
            </div>
            
            {/* Driver Information */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-[#264653] mb-4 border-b pb-2">Driver Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600">
                    <span className="font-medium">Name:</span> {carpoolData.driver.full_name || carpoolData.driver.username}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Vehicle Information */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-[#264653] mb-4 border-b pb-2">Vehicle Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600">
                    <span className="font-medium">Vehicle:</span> {carpoolData.vehicle.full_description || "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">
                    <span className="font-medium">License Plate:</span> {carpoolData.vehicle.license_plate || "Not specified"}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Route Information */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-[#264653] mb-4 border-b pb-2">Route Information</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-600">
                      <span className="font-medium">Origin:</span> {formatAddress(carpoolData.route.origin)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">
                      <span className="font-medium">Destination:</span> {formatAddress(carpoolData.route.destination)}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-gray-600">
                      <span className="font-medium">Earliest Departure:</span> {formatDateTime(carpoolData.route.leave_earliest)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">
                      <span className="font-medium">Arrive By:</span> {formatDateTime(carpoolData.route.arrive_by)}
                    </p>
                  </div>
                </div>
                
                {/* Route Info if available */}
                {carpoolData.route_info && (
                  <div className="mt-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-medium text-gray-700 mb-2">Additional Route Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {carpoolData.route_info.total_distance && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Total Distance:</span> {carpoolData.route_info.total_distance} mi
                        </p>
                      )}
                      {carpoolData.route_info.total_duration && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Total Duration:</span> {carpoolData.route_info.total_duration} min
                        </p>
                      )}
                      {carpoolData.route_info.new_departure_time && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Departure Time:</span> {carpoolData.route_info.new_departure_time}
                        </p>
                      )}
                      {carpoolData.route_info.is_viable !== undefined && (
                        <p className={`text-sm font-medium ${carpoolData.route_info.is_viable ? 'text-green-600' : 'text-red-600'}`}>
                          {carpoolData.route_info.is_viable 
                            ? "✓ This carpool is a good match" 
                            : "✗ This carpool might not work"}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Display the map if user is driver or passenger */}
                {(userRole.isDriver || userRole.isPassenger) && (
                  <div className="mt-6">
                    <h4 className="font-medium text-gray-700 mb-2">Route Map</h4>
                    <button
                      onClick={() => setShowRouteMap(true)}
                      className="w-full py-3 bg-[#2A9D8F] text-white rounded-lg hover:bg-[#238579] transition-colors flex items-center justify-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      View Route Map
                    </button>
                    
                    {/* Route Map Modal */}
                    <RouteMapModal
                      isOpen={showRouteMap}
                      onClose={() => setShowRouteMap(false)}
                      carpoolId={carpoolId}
                      userRole={userRole}
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Passenger Information */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-[#264653] mb-4 border-b pb-2">
                Passengers ({carpoolData.passengers.length})
              </h3>
              
              {carpoolData.passengers.length === 0 ? (
                <p className="text-gray-600 italic">No passengers yet</p>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {carpoolData.passengers.map((passenger, index) => (
                    <div key={passenger.passenger_id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-2">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                            <strong>{passenger.full_name}</strong>
                          </span>
                          {/* Show Kick button if user is the driver */}
                          {userRole.isDriver && (
                            <button
                              onClick={() => handleRemovePassenger(passenger.passenger_id)}
                              disabled={actionLoading}
                              className="text-red-600 bg-red-100 hover:bg-red-200 px-2 py-1 rounded text-xs disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                              {actionLoading ? 'Processing...' : 'Kick'}
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                        <div>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Pickup:</span> {passenger.pickup_location}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Pickup Time:</span> {passenger.pickup_time || "Not specified"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Dropoff:</span> {passenger.dropoff_location}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Dropoff Time:</span> {passenger.dropoff_time || "Not specified"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-10 bg-white rounded-lg shadow-lg p-6">
            <p className="text-gray-600 text-lg mb-4">Carpool not found or you don't have permission to view it</p>
            <button
              onClick={handleGoBack}
              className="px-6 py-2 bg-[#2A9D8F] text-white rounded-lg hover:bg-[#238579]"
            >
              Return to Carpool Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CarpoolListingPage; 